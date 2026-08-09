import {
  computed,
  DestroyRef,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  signal,
} from '@angular/core';
import type { EnvironmentProviders, Signal } from '@angular/core';
import { createTrackedTranslator } from './adapter.js';
import type { I18n, MessageTree, Translator } from './types.js';

export interface AngularTranslify<Messages extends MessageTree = MessageTree> {
  readonly i18n: I18n<Messages>;
  readonly locale: Signal<string>;
  readonly t: Translator<MessageTree>;
  getTranslations(namespace?: string): Translator<MessageTree>;
  destroy(): void;
}

export const TRANSLIFY_ANGULAR = new InjectionToken<AngularTranslify>('Translify');

export function createAngularI18n<Messages extends MessageTree>(
  i18n: I18n<Messages>,
): AngularTranslify<Messages> {
  const revision = signal(i18n.revision);
  const stop = i18n.subscribe(() => revision.set(i18n.revision));
  const track = () => void revision();
  return {
    i18n,
    locale: computed(() => {
      track();
      return i18n.locale;
    }),
    t: createTrackedTranslator(i18n, track),
    getTranslations: (namespace?: string) => createTrackedTranslator(i18n, track, namespace),
    destroy: stop,
  };
}

export function provideTranslify(i18n: I18n<MessageTree>): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: TRANSLIFY_ANGULAR,
      useFactory: () => {
        const state = createAngularI18n(i18n);
        inject(DestroyRef).onDestroy(state.destroy);
        return state;
      },
    },
  ]);
}

export function injectTranslify<
  Messages extends MessageTree = MessageTree,
>(): AngularTranslify<Messages> {
  return inject(TRANSLIFY_ANGULAR) as AngularTranslify<Messages>;
}

export type { I18n, MessageTree, Translator } from './types.js';
