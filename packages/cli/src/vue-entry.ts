import {
  TRANSLIFY_VUE_KEY as RUNTIME_KEY,
  createVueI18n as createRuntimeVueI18n,
  useI18n as useRuntimeI18n,
  useTranslations as useRuntimeTranslations,
} from '@ndnci/translify-runtime/vue';
import type { I18n, MessageTree, Translator } from '@ndnci/translify-runtime';
import type { ComputedRef, InjectionKey, Plugin } from 'vue';

export interface VueTranslify<Messages extends MessageTree = MessageTree> {
  readonly i18n: I18n<Messages>;
  readonly locale: ComputedRef<string>;
  readonly t: Translator<MessageTree>;
  getTranslations(namespace?: string): Translator<MessageTree>;
}

export type TranslifyVuePlugin<Messages extends MessageTree = MessageTree> = Plugin & {
  readonly state: VueTranslify<Messages>;
};

export const TRANSLIFY_VUE_KEY = RUNTIME_KEY as InjectionKey<VueTranslify<MessageTree>>;

export function createVueI18n<Messages extends MessageTree>(
  i18n: I18n<Messages>,
): TranslifyVuePlugin<Messages> {
  return createRuntimeVueI18n(i18n as I18n<MessageTree>) as TranslifyVuePlugin<Messages>;
}

export function useI18n<Messages extends MessageTree = MessageTree>(): VueTranslify<Messages> {
  return useRuntimeI18n<Messages>() as VueTranslify<Messages>;
}

export function useTranslations(namespace?: string): Translator<MessageTree> {
  return useRuntimeTranslations(namespace);
}

export type { I18n, MessageTree, Translator };
