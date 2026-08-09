import { createI18n } from './runtime.js';
import { canonicalizeLocale, matchSupportedLocale } from './locale.js';
import type {
  CreateNextI18nOptions,
  GetTranslationsOptions,
  I18n,
  MessageTree,
  NamespaceKeys,
  NamespaceValue,
  NextI18n,
  Translator,
} from './types.js';

export function createNextI18n<const Locale extends string>(
  options: CreateNextI18nOptions<Locale>,
): NextI18n<Locale> {
  const locales = (options.locales ?? options.config.routing?.locales) as
    | readonly Locale[]
    | undefined;
  if (!locales || locales.length === 0) {
    throw new Error('Add routing.locales to translify.config or pass locales to createNextI18n.');
  }
  const matchedDefaultLocale = matchSupportedLocale(
    locales,
    options.config.translations.default_language,
  );
  if (!matchedDefaultLocale) {
    throw new Error(
      `translify.config default language "${options.config.translations.default_language}" is not included in locales.`,
    );
  }
  const defaultLocale = matchedDefaultLocale as Locale;

  const resolveLocale = (locale?: string): Locale => {
    const matched = locale ? matchSupportedLocale(locales, locale) : undefined;
    return (matched as Locale | undefined) ?? defaultLocale;
  };

  const loadCatalogs = async (locale?: string) => {
    const resolvedLocale = resolveLocale(locale);
    const [currentMessages, fallbackMessages] = await Promise.all([
      options.loadMessages(resolvedLocale),
      resolvedLocale === defaultLocale
        ? Promise.resolve(undefined)
        : options.loadMessages(defaultLocale),
    ]);

    return {
      locale: resolvedLocale,
      defaultLocale,
      messages: {
        [defaultLocale]: fallbackMessages ?? currentMessages,
        [resolvedLocale]: currentMessages,
      },
    };
  };

  const getI18n = async (locale?: string): Promise<I18n<MessageTree>> => {
    const config = await loadCatalogs(locale);

    return createI18n({
      ...config,
      ...(options.timeZone && { timeZone: options.timeZone }),
    });
  };

  const getTranslations = async ({ locale, namespace }: GetTranslationsOptions = {}): Promise<
    Translator<MessageTree>
  > => {
    const i18n = await getI18n(locale);
    return namespace ? i18n.getTranslator(namespace) : i18n.t;
  };

  const getMessages = async (locale?: string): Promise<MessageTree> => {
    const resolvedLocale = resolveLocale(locale);
    return options.loadMessages(resolvedLocale);
  };

  return {
    defaultLocale,
    locales,
    resolveLocale,
    isLocale: (locale: string): locale is Locale => {
      const canonical = canonicalizeLocale(locale);
      return (
        canonical !== undefined &&
        locales.some((supported) => canonicalizeLocale(supported) === canonical)
      );
    },
    getI18n,
    getTranslations,
    getMessages,
    getClientConfig: async (locale?: string) => ({
      ...(await loadCatalogs(locale)),
      ...(options.timeZone && { timeZone: options.timeZone }),
    }),
    generateStaticParams: () => locales.map((locale) => ({ locale })),
  };
}

export type {
  CreateNextI18nOptions,
  GetTranslationsOptions,
  I18n,
  MessageTree,
  NamespaceKeys,
  NamespaceValue,
  NextI18n,
  Translator,
};
