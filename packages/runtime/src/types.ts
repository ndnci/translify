export type MessageTree = Readonly<Record<string, unknown>>;
export type MessageCatalog = Readonly<Record<string, MessageTree>>;

type StringKey<T> = Extract<keyof T, string>;

export type MessageKeys<T> = T extends unknown
  ? string extends keyof T
    ? string
    : {
        [Key in StringKey<T>]: T[Key] extends string
          ? Key
          : T[Key] extends Readonly<Record<string, unknown>>
            ? `${Key}.${MessageKeys<T[Key]>}`
            : never;
      }[StringKey<T>]
  : never;

export type NamespaceKeys<T> = T extends unknown
  ? string extends keyof T
    ? string
    : {
        [Key in StringKey<T>]: T[Key] extends Readonly<Record<string, unknown>>
          ? Key | `${Key}.${NamespaceKeys<T[Key]>}`
          : never;
      }[StringKey<T>]
  : never;

export type NamespaceValue<T, Path extends string> = T extends unknown
  ? Path extends `${infer Head}.${infer Rest}`
    ? Head extends keyof T
      ? NamespaceValue<T[Head], Rest>
      : never
    : Path extends keyof T
      ? T[Path]
      : never
  : never;

export type TranslationValue = string | number | bigint | boolean | Date | null | undefined;
export type TranslationValues = Record<string, TranslationValue>;
export type MissingMessageBehavior = 'key' | 'empty' | 'throw';

export type RuntimeErrorCode =
  | 'INVALID_LOCALE'
  | 'MISSING_MESSAGE'
  | 'INVALID_MESSAGE'
  | 'FORMAT_ERROR';

export class TranslifyRuntimeError extends Error {
  override readonly name = 'TranslifyRuntimeError';

  constructor(
    readonly code: RuntimeErrorCode,
    message: string,
    readonly key?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export interface Translator<Messages extends MessageTree = MessageTree> {
  <Key extends MessageKeys<Messages>>(key: Key, values?: TranslationValues): string;
  has<Key extends MessageKeys<Messages>>(key: Key): boolean;
  raw<Key extends MessageKeys<Messages>>(key: Key): unknown;
}

export interface I18n<Messages extends MessageTree = MessageTree> {
  readonly locale: string;
  readonly defaultLocale: string;
  readonly availableLocales: readonly string[];
  readonly revision: number;
  readonly t: Translator<Messages>;
  has<Key extends MessageKeys<Messages>>(key: Key): boolean;
  raw<Key extends MessageKeys<Messages>>(key: Key): unknown;
  getTranslator<const Namespace extends NamespaceKeys<Messages>>(
    namespace: Namespace,
  ): Translator<Extract<NamespaceValue<Messages, Namespace>, MessageTree>>;
  setLocale(locale: string): void;
  setMessages(locale: string, messages: MessageTree): void;
  subscribe(listener: () => void): () => void;
  formatNumber(value: number | bigint, options?: Intl.NumberFormatOptions): string;
  formatDate(value: Date | number | string, options?: Intl.DateTimeFormatOptions): string;
  formatList(values: Iterable<string>, options?: Intl.ListFormatOptions): string;
  formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions,
  ): string;
}

export interface CreateI18nOptions<Catalogs extends MessageCatalog> {
  locale: string;
  defaultLocale: string;
  messages: Catalogs;
  missingMessage?: MissingMessageBehavior;
  timeZone?: string;
  onError?: (error: TranslifyRuntimeError) => void;
}

export interface TranslifyConfigLike {
  translations: {
    default_language: string;
  };
}

export type I18nProviderConfig =
  | {
      i18n: I18n<MessageTree>;
      locale?: never;
      defaultLocale?: never;
      messages?: never;
      missingMessage?: never;
      timeZone?: never;
    }
  | {
      i18n?: never;
      locale: string;
      defaultLocale: string;
      messages: MessageCatalog;
      missingMessage?: MissingMessageBehavior;
      timeZone?: string;
    };

export interface CreateNextI18nOptions<Locale extends string> {
  config: TranslifyConfigLike;
  locales: readonly Locale[];
  loadMessages: (locale: Locale) => MessageTree | Promise<MessageTree>;
  timeZone?: string;
}

export interface GetTranslationsOptions {
  locale?: string;
  namespace?: string;
}

export interface NextClientConfig {
  locale: string;
  defaultLocale: string;
  messages: MessageCatalog;
  timeZone?: string;
}

export interface NextI18n<Locale extends string> {
  readonly defaultLocale: Locale;
  readonly locales: readonly Locale[];
  resolveLocale(locale?: string): Locale;
  isLocale(locale: string): locale is Locale;
  getI18n(locale?: string): Promise<I18n<MessageTree>>;
  getTranslations(options?: GetTranslationsOptions): Promise<Translator<MessageTree>>;
  getMessages(locale?: string): Promise<MessageTree>;
  getClientConfig(locale?: string): Promise<NextClientConfig>;
  generateStaticParams(): Array<{ locale: Locale }>;
}

export type CatalogMessages<Catalogs extends MessageCatalog> = Extract<
  Catalogs[keyof Catalogs],
  MessageTree
>;
