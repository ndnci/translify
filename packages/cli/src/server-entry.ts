import { deepMerge, type TranslifyConfig, type TranslationRecord } from '@ndnci/translify-shared';
import { resolveConfig } from '@ndnci/translify-config';
import { loadTranslationFile, scanTranslationFiles } from '@ndnci/translify-core';
import {
  createI18n,
  createI18nRouter,
  detectLocale,
  type I18n,
  type MessageTree,
  type MissingMessageBehavior,
  type Translator,
} from '@ndnci/translify-runtime';

export interface CreateServerI18nOptions {
  /** Project directory containing translify.config.*. */
  cwd?: string;
  configPath?: string;
  /** Explicit request locale. Takes priority over URL and header detection. */
  locale?: string;
  /** Standard Web Request, supported by Node, edge and serverless runtimes. */
  request?: Request;
  timeZone?: string;
  missingMessage?: MissingMessageBehavior;
  onError?: (error: Error) => void;
}

export interface GetServerTranslationsOptions extends CreateServerI18nOptions {
  namespace?: string;
}

/**
 * Loads translify.config and JSON catalogues from disk, then creates a fresh
 * request-scoped runtime. No locale state is shared between requests.
 */
export async function createServerI18n(
  options: CreateServerI18nOptions = {},
): Promise<I18n<MessageTree>> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await resolveConfig({
    cwd,
    ...(options.configPath && { configPath: options.configPath }),
  });
  const catalogs = await loadCatalogs(config, cwd);
  const locale = resolveRequestLocale(config, catalogs, options);

  return createI18n({
    locale,
    defaultLocale: config.translations.default_language,
    messages: catalogs,
    ...(options.timeZone && { timeZone: options.timeZone }),
    ...(options.missingMessage && { missingMessage: options.missingMessage }),
    ...(options.onError && { onError: options.onError }),
  });
}

/** Creates a direct server translator, optionally scoped to a namespace. */
export async function getServerTranslations(
  options: GetServerTranslationsOptions = {},
): Promise<Translator<MessageTree>> {
  const i18n = await createServerI18n(options);
  return options.namespace ? i18n.getTranslator(options.namespace) : i18n.t;
}

async function loadCatalogs(
  config: TranslifyConfig,
  cwd: string,
): Promise<Record<string, MessageTree>> {
  const paths = await scanTranslationFiles(config, cwd);
  const catalogs: Record<string, TranslationRecord> = {};

  for (const path of paths) {
    const file = loadTranslationFile(path);
    catalogs[file.language] = deepMerge(catalogs[file.language] ?? {}, file.data);
  }

  if (Object.keys(catalogs).length === 0) {
    throw new Error(`No translation files matched: ${config.translations.files.join(', ')}`);
  }
  return catalogs;
}

function resolveRequestLocale(
  config: TranslifyConfig,
  catalogs: Readonly<Record<string, MessageTree>>,
  options: CreateServerI18nOptions,
): string {
  if (options.locale) return options.locale;

  if (options.request && config.routing.locales.length > 0) {
    return createI18nRouter({
      translations: config.translations,
      routing: config.routing,
    }).resolve(options.request).locale;
  }

  const accepted = options.request?.headers
    .get('accept-language')
    ?.split(',')
    .map((entry) => entry.split(';')[0]?.trim())
    .filter((locale): locale is string => Boolean(locale));
  return detectLocale(Object.keys(catalogs), config.translations.default_language, accepted ?? []);
}

export type { I18n, MessageTree, MissingMessageBehavior, Translator };
