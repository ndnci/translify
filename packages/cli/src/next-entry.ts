import { createNextI18n as createRuntimeNextI18n } from '@ndnci/translify-runtime/next';
export { createI18nRouter } from '@ndnci/translify-runtime';
import type {
  CreateNextI18nOptions,
  GetTranslationsOptions,
  I18n,
  MessageTree,
  NamespaceKeys,
  NamespaceValue,
  NextClientConfig,
  NextI18n,
  Translator,
} from '@ndnci/translify-runtime';

export function createNextI18n<const Locale extends string>(
  options: CreateNextI18nOptions<Locale>,
): NextI18n<Locale> {
  return createRuntimeNextI18n(options);
}

export type {
  CreateNextI18nOptions,
  GetTranslationsOptions,
  I18n,
  MessageTree,
  NamespaceKeys,
  NamespaceValue,
  NextClientConfig,
  NextI18n,
  Translator,
};
