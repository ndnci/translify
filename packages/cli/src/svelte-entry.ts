import {
  createTranslifyStore as createRuntimeStore,
  getTranslifyContext as getRuntimeContext,
  setTranslifyContext as setRuntimeContext,
  useTranslations as useRuntimeTranslations,
} from '@ndnci/translify-runtime/svelte';
import type { I18n, MessageTree, Translator } from '@ndnci/translify-runtime';

export interface SvelteTranslify<Messages extends MessageTree = MessageTree> {
  readonly i18n: I18n<Messages>;
  readonly locale: string;
  readonly t: Translator<MessageTree>;
  getTranslations(namespace?: string): Translator<MessageTree>;
  subscribe(listener: (state: SvelteTranslify<Messages>) => void): () => void;
}

export function createTranslifyStore<Messages extends MessageTree>(
  i18n: I18n<Messages>,
): SvelteTranslify<Messages> {
  return createRuntimeStore(i18n as I18n<MessageTree>) as SvelteTranslify<Messages>;
}

export function setTranslifyContext<Messages extends MessageTree>(
  i18n: I18n<Messages>,
): SvelteTranslify<Messages> {
  return setRuntimeContext(i18n as I18n<MessageTree>) as SvelteTranslify<Messages>;
}

export function getTranslifyContext<
  Messages extends MessageTree = MessageTree,
>(): SvelteTranslify<Messages> {
  return getRuntimeContext<Messages>() as SvelteTranslify<Messages>;
}

export function useTranslations(namespace?: string): Translator<MessageTree> {
  return useRuntimeTranslations(namespace);
}

export type { I18n, MessageTree, Translator };
