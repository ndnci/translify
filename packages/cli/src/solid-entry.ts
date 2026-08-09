import {
  TranslifyProvider as RuntimeProvider,
  createSolidI18n as createRuntimeSolidI18n,
  useI18n as useRuntimeI18n,
  useTranslations as useRuntimeTranslations,
} from '@ndnci/translify-runtime/solid';
import type { I18n, MessageTree, Translator } from '@ndnci/translify-runtime';
import type { Accessor, ParentComponent } from 'solid-js';

export interface SolidTranslify<Messages extends MessageTree = MessageTree> {
  readonly i18n: I18n<Messages>;
  readonly locale: Accessor<string>;
  readonly t: Translator<MessageTree>;
  getTranslations(namespace?: string): Translator<MessageTree>;
  destroy(): void;
}

export function createSolidI18n<Messages extends MessageTree>(
  i18n: I18n<Messages>,
): SolidTranslify<Messages> {
  return createRuntimeSolidI18n(i18n as I18n<MessageTree>) as SolidTranslify<Messages>;
}

export const TranslifyProvider = RuntimeProvider as ParentComponent<{
  i18n: I18n<MessageTree>;
}>;

export function useI18n<Messages extends MessageTree = MessageTree>(): SolidTranslify<Messages> {
  return useRuntimeI18n<Messages>() as SolidTranslify<Messages>;
}

export function useTranslations(namespace?: string): Translator<MessageTree> {
  return useRuntimeTranslations(namespace);
}

export type { I18n, MessageTree, Translator };
