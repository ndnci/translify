import { getContext, setContext } from 'svelte';
import { createTrackedTranslator } from './adapter.js';
import type { I18n, MessageTree, Translator } from './types.js';

export interface SvelteTranslify<Messages extends MessageTree = MessageTree> {
  readonly i18n: I18n<Messages>;
  readonly locale: string;
  readonly t: Translator<MessageTree>;
  getTranslations(namespace?: string): Translator<MessageTree>;
  subscribe(listener: (state: SvelteTranslify<Messages>) => void): () => void;
}

const TRANSLIFY_SVELTE_KEY = Symbol('translify');

export function createTranslifyStore<Messages extends MessageTree>(
  i18n: I18n<Messages>,
): SvelteTranslify<Messages> {
  let revision = i18n.revision;
  const track = () => void revision;
  const state: SvelteTranslify<Messages> = {
    i18n,
    get locale() {
      track();
      return i18n.locale;
    },
    t: createTrackedTranslator(i18n, track),
    getTranslations: (namespace?: string) => createTrackedTranslator(i18n, track, namespace),
    subscribe(listener) {
      listener(state);
      return i18n.subscribe(() => {
        revision = i18n.revision;
        listener(state);
      });
    },
  };
  return state;
}

export function setTranslifyContext<Messages extends MessageTree>(
  i18n: I18n<Messages>,
): SvelteTranslify<Messages> {
  return setContext(TRANSLIFY_SVELTE_KEY, createTranslifyStore(i18n));
}

export function getTranslifyContext<
  Messages extends MessageTree = MessageTree,
>(): SvelteTranslify<Messages> {
  const state = getContext<SvelteTranslify<Messages> | undefined>(TRANSLIFY_SVELTE_KEY);
  if (!state) throw new Error('Translify context must be initialized in a parent component.');
  return state;
}

export function useTranslations(namespace?: string): Translator<MessageTree> {
  return getTranslifyContext().getTranslations(namespace);
}

export type { I18n, MessageTree, Translator } from './types.js';
