import { computed, inject, shallowRef } from 'vue';
import type { App, ComputedRef, InjectionKey, Plugin } from 'vue';
import { createTrackedTranslator } from './adapter.js';
import type { I18n, MessageTree, Translator } from './types.js';

export interface VueTranslify<Messages extends MessageTree = MessageTree> {
  readonly i18n: I18n<Messages>;
  readonly locale: ComputedRef<string>;
  readonly t: Translator<MessageTree>;
  getTranslations(namespace?: string): Translator<MessageTree>;
}

export type TranslifyVuePlugin<Messages extends MessageTree = MessageTree> = Plugin & {
  readonly state: VueTranslify<Messages>;
};

export const TRANSLIFY_VUE_KEY: InjectionKey<VueTranslify<MessageTree>> = Symbol('translify');

export function createVueI18n<Messages extends MessageTree>(
  i18n: I18n<Messages>,
): TranslifyVuePlugin<Messages> {
  const revision = shallowRef(i18n.revision);
  const stop = i18n.subscribe(() => (revision.value = i18n.revision));
  const track = () => void revision.value;
  const state: VueTranslify<Messages> = {
    i18n,
    locale: computed(() => {
      track();
      return i18n.locale;
    }),
    t: createTrackedTranslator(i18n, track),
    getTranslations: (namespace?: string) => createTrackedTranslator(i18n, track, namespace),
  };

  return {
    state,
    install(app: App) {
      app.provide(TRANSLIFY_VUE_KEY, state as VueTranslify<MessageTree>);
      app.config.globalProperties.$translify = state;
      app.config.globalProperties.$t = state.t;
      app.onUnmount(stop);
    },
  };
}

export function useI18n<Messages extends MessageTree = MessageTree>(): VueTranslify<Messages> {
  const state = inject(TRANSLIFY_VUE_KEY);
  if (!state) throw new Error('Translify composables require app.use(createVueI18n(i18n)).');
  return state as VueTranslify<Messages>;
}

export function useTranslations(namespace?: string): Translator<MessageTree> {
  return useI18n().getTranslations(namespace);
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $translify: VueTranslify;
    $t: Translator<MessageTree>;
  }
}

export type { I18n, MessageTree, Translator } from './types.js';
