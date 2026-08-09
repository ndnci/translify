import { IntlMessageFormat } from 'intl-messageformat';
import {
  canonicalizeLocale,
  detectLocale,
  localeCandidates,
  matchSupportedLocale,
} from './locale.js';
import {
  TranslifyRuntimeError,
  type CatalogMessages,
  type CreateI18nOptions,
  type I18n,
  type MessageCatalog,
  type MessageKeys,
  type MessageTree,
  type MissingMessageBehavior,
  type NamespaceKeys,
  type NamespaceValue,
  type TranslationValues,
  type Translator,
  type TranslifyConfigLike,
} from './types.js';

const BLOCKED_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

interface ResolvedMessage {
  value: unknown;
  locale: string;
}

export function createI18n<const Catalogs extends MessageCatalog>(
  input: CreateI18nOptions<Catalogs> | (TranslifyConfigLike & { runtime: { messages: Catalogs } }),
): I18n<CatalogMessages<Catalogs>> {
  const options: CreateI18nOptions<Catalogs> = 'translations' in input ? { config: input } : input;
  return new RuntimeI18n(resolveRuntimeOptions(options));
}

export function createI18nFromConfig<const Catalogs extends MessageCatalog>(
  config: TranslifyConfigLike,
  options: Omit<CreateI18nOptions<Catalogs>, 'defaultLocale'>,
): I18n<CatalogMessages<Catalogs>> {
  return createI18n({
    ...options,
    config,
  });
}

type ResolvedCreateI18nOptions<Catalogs extends MessageCatalog> = Omit<
  CreateI18nOptions<Catalogs>,
  'config' | 'useConfig' | 'locale' | 'defaultLocale' | 'messages'
> & {
  locale: string;
  defaultLocale: string;
  messages: Catalogs;
};

function resolveRuntimeOptions<Catalogs extends MessageCatalog>(
  options: CreateI18nOptions<Catalogs>,
): ResolvedCreateI18nOptions<Catalogs> {
  const config =
    options.useConfig === false || options.config === false ? undefined : options.config;
  const messages = options.messages ?? (config?.runtime?.messages as Catalogs | undefined);
  if (!messages || Object.keys(messages).length === 0) {
    throw new Error(
      'No runtime messages were provided. Add runtime.messages to translify.config or pass messages to createI18n().',
    );
  }

  const availableLocales = Object.keys(messages);
  const defaultLocale =
    options.defaultLocale ?? config?.translations.default_language ?? availableLocales[0];
  if (!defaultLocale) throw new Error('At least one runtime locale is required.');

  const configuredLocale = config?.runtime?.locale;
  const locale =
    options.locale ??
    (configuredLocale && configuredLocale !== 'auto'
      ? configuredLocale
      : detectLocale(availableLocales, defaultLocale));

  const missingMessage = options.missingMessage ?? config?.runtime?.missing_message;
  const timeZone = options.timeZone ?? config?.runtime?.time_zone;
  return {
    locale,
    defaultLocale,
    messages,
    ...(missingMessage && { missingMessage }),
    ...(timeZone && { timeZone }),
    ...(options.onError && { onError: options.onError }),
  };
}

class RuntimeI18n<const Catalogs extends MessageCatalog> implements I18n<
  CatalogMessages<Catalogs>
> {
  readonly defaultLocale: string;
  readonly t: Translator<CatalogMessages<Catalogs>>;

  private currentLocale: string;
  private catalogs: Record<string, MessageTree>;
  private readonly missingMessage: MissingMessageBehavior;
  private readonly timeZone: string | undefined;
  private readonly onError: (error: TranslifyRuntimeError) => void;
  private readonly listeners = new Set<() => void>();
  private readonly messageFormats = new Map<string, IntlMessageFormat>();
  private readonly numberFormats = new Map<string, Intl.NumberFormat>();
  private readonly dateFormats = new Map<string, Intl.DateTimeFormat>();
  private readonly listFormats = new Map<string, Intl.ListFormat>();
  private readonly relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>();
  private version = 0;

  constructor(options: ResolvedCreateI18nOptions<Catalogs>) {
    this.catalogs = { ...options.messages };
    this.defaultLocale = this.requireAvailableLocale(options.defaultLocale, 'default locale');
    this.currentLocale = this.requireAvailableLocale(options.locale, 'locale');
    this.missingMessage = options.missingMessage ?? 'key';
    this.timeZone = options.timeZone;
    this.onError = options.onError ?? (() => undefined);
    this.t = this.createTranslator();
  }

  get locale(): string {
    return this.currentLocale;
  }

  get availableLocales(): readonly string[] {
    return Object.freeze(Object.keys(this.catalogs));
  }

  get revision(): number {
    return this.version;
  }

  has<Key extends MessageKeys<CatalogMessages<Catalogs>>>(key: Key): boolean {
    return this.t.has(key);
  }

  raw<Key extends MessageKeys<CatalogMessages<Catalogs>>>(key: Key): unknown {
    return this.t.raw(key);
  }

  getTranslator<const Namespace extends NamespaceKeys<CatalogMessages<Catalogs>>>(
    namespace: Namespace,
  ): Translator<Extract<NamespaceValue<CatalogMessages<Catalogs>, Namespace>, MessageTree>> {
    return this.createTranslator(String(namespace)) as Translator<
      Extract<NamespaceValue<CatalogMessages<Catalogs>, Namespace>, MessageTree>
    >;
  }

  setLocale(locale: string): void {
    const nextLocale = this.requireAvailableLocale(locale, 'locale');
    if (nextLocale === this.currentLocale) return;
    this.currentLocale = nextLocale;
    this.messageFormats.clear();
    this.notify();
  }

  setMessages(locale: string, messages: MessageTree): void {
    const canonical = canonicalizeLocale(locale);
    if (!canonical) {
      throw new TranslifyRuntimeError('INVALID_LOCALE', `Invalid locale: "${locale}"`);
    }

    const existing = this.catalogKey(canonical) ?? canonical;
    this.catalogs = { ...this.catalogs, [existing]: messages };
    this.messageFormats.clear();
    this.notify();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  formatNumber(value: number | bigint, options: Intl.NumberFormatOptions = {}): string {
    const formatter = cachedFormatter(
      this.numberFormats,
      this.currentLocale,
      options,
      (locale) => new Intl.NumberFormat(locale, options),
    );
    return formatter.format(value);
  }

  formatDate(value: Date | number | string, options: Intl.DateTimeFormatOptions = {}): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new TranslifyRuntimeError('FORMAT_ERROR', `Invalid date value: "${String(value)}"`);
    }

    const resolvedOptions =
      this.timeZone && options.timeZone === undefined
        ? { ...options, timeZone: this.timeZone }
        : options;
    const formatter = cachedFormatter(
      this.dateFormats,
      this.currentLocale,
      resolvedOptions,
      (locale) => new Intl.DateTimeFormat(locale, resolvedOptions),
    );
    return formatter.format(date);
  }

  formatList(values: Iterable<string>, options: Intl.ListFormatOptions = {}): string {
    const formatter = cachedFormatter(
      this.listFormats,
      this.currentLocale,
      options,
      (locale) => new Intl.ListFormat(locale, options),
    );
    return formatter.format(values);
  }

  formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
  ): string {
    const formatter = cachedFormatter(
      this.relativeTimeFormats,
      this.currentLocale,
      options,
      (locale) => new Intl.RelativeTimeFormat(locale, options),
    );
    return formatter.format(value, unit);
  }

  private createTranslator(namespace?: string): Translator<MessageTree> {
    const qualify = (key: string) => (namespace ? `${namespace}.${key}` : key);
    const translate = ((key: string, values?: TranslationValues) =>
      this.translate(qualify(key), values)) as Translator<MessageTree>;
    translate.has = (key: string) => this.resolveMessage(qualify(key)) !== undefined;
    translate.raw = (key: string) => this.resolveMessage(qualify(key))?.value;
    return translate;
  }

  private translate(key: string, values?: TranslationValues): string {
    const resolved = this.resolveMessage(key);
    if (!resolved) return this.handleMissingMessage(key);
    if (typeof resolved.value !== 'string') {
      const error = new TranslifyRuntimeError(
        'INVALID_MESSAGE',
        `Message "${key}" must resolve to a string. Use raw() to read objects.`,
        key,
      );
      this.onError(error);
      throw error;
    }

    try {
      const cacheKey = `${this.currentLocale}\u0000${resolved.value}`;
      let formatter = this.messageFormats.get(cacheKey);
      if (!formatter) {
        formatter = new IntlMessageFormat(
          resolved.value,
          this.currentLocale,
          this.messageDateTimeFormats(),
          { ignoreTag: true },
        );
        this.messageFormats.set(cacheKey, formatter);
      }
      const formatted = formatter.format(values as never);
      return Array.isArray(formatted) ? formatted.join('') : String(formatted);
    } catch (cause) {
      const error = new TranslifyRuntimeError(
        'FORMAT_ERROR',
        `Could not format message "${key}" for locale "${this.currentLocale}".`,
        key,
        { cause },
      );
      this.onError(error);
      throw error;
    }
  }

  private resolveMessage(key: string): ResolvedMessage | undefined {
    for (const locale of this.fallbackChain()) {
      const catalog = this.catalogs[locale];
      if (!catalog) continue;
      const value = getPath(catalog, key);
      if (value !== undefined) return { value, locale };
    }
    return undefined;
  }

  private fallbackChain(): string[] {
    const chain: string[] = [];
    const addCandidates = (locale: string) => {
      for (const candidate of localeCandidates(locale)) {
        const key = this.catalogKey(candidate);
        if (key && !chain.includes(key)) chain.push(key);
      }
    };

    addCandidates(this.currentLocale);
    addCandidates(this.defaultLocale);
    return chain;
  }

  private handleMissingMessage(key: string): string {
    const error = new TranslifyRuntimeError(
      'MISSING_MESSAGE',
      `Message "${key}" is missing for locale "${this.currentLocale}" and its fallbacks.`,
      key,
    );
    this.onError(error);
    if (this.missingMessage === 'throw') throw error;
    return this.missingMessage === 'empty' ? '' : key;
  }

  private requireAvailableLocale(locale: string, label: string): string {
    const match = matchSupportedLocale(Object.keys(this.catalogs), locale);
    if (match) return match;

    throw new TranslifyRuntimeError(
      'INVALID_LOCALE',
      `The ${label} "${locale}" has no matching message catalogue. Available locales: ${Object.keys(this.catalogs).join(', ')}.`,
    );
  }

  private catalogKey(locale: string): string | undefined {
    const canonical = canonicalizeLocale(locale);
    if (!canonical) return undefined;
    return Object.keys(this.catalogs).find(
      (candidate) => canonicalizeLocale(candidate) === canonical,
    );
  }

  private messageDateTimeFormats(): ConstructorParameters<typeof IntlMessageFormat>[2] {
    if (!this.timeZone) return undefined;
    return {
      date: {
        short: { year: '2-digit', month: 'numeric', day: 'numeric', timeZone: this.timeZone },
        medium: { year: 'numeric', month: 'short', day: 'numeric', timeZone: this.timeZone },
        long: { year: 'numeric', month: 'long', day: 'numeric', timeZone: this.timeZone },
        full: {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: this.timeZone,
        },
      },
      time: {
        short: { hour: 'numeric', minute: 'numeric', timeZone: this.timeZone },
        medium: {
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          timeZone: this.timeZone,
        },
      },
    };
  }

  private notify(): void {
    this.version += 1;
    for (const listener of [...this.listeners]) listener();
  }
}

function getPath(source: MessageTree, path: string): unknown {
  if (!path || BLOCKED_PATH_SEGMENTS.has(path)) return undefined;
  if (Object.prototype.hasOwnProperty.call(source, path)) return source[path];

  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (BLOCKED_PATH_SEGMENTS.has(segment) || !isRecord(current)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cachedFormatter<Options extends object, Formatter>(
  cache: Map<string, Formatter>,
  locale: string,
  options: Options,
  create: (locale: string) => Formatter,
): Formatter {
  const key = `${locale}\u0000${stableOptionsKey(options)}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = create(locale);
    cache.set(key, formatter);
  }
  return formatter;
}

function stableOptionsKey(options: object): string {
  return JSON.stringify(
    Object.entries(options).sort(([left], [right]) => left.localeCompare(right)),
  );
}
