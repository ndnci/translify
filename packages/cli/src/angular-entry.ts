import {
  TRANSLIFY_ANGULAR as RUNTIME_TOKEN,
  createAngularI18n as createRuntimeAngularI18n,
  injectTranslify as injectRuntimeTranslify,
  provideTranslify as provideRuntimeTranslify,
} from '@ndnci/translify-runtime/angular';
import type { I18n, MessageTree, Translator } from '@ndnci/translify-runtime';
import type { EnvironmentProviders, InjectionToken, Signal } from '@angular/core';

export interface AngularTranslify<Messages extends MessageTree = MessageTree> {
  readonly i18n: I18n<Messages>;
  readonly locale: Signal<string>;
  readonly t: Translator<MessageTree>;
  getTranslations(namespace?: string): Translator<MessageTree>;
  destroy(): void;
}

export const TRANSLIFY_ANGULAR = RUNTIME_TOKEN as InjectionToken<AngularTranslify>;

export function createAngularI18n<Messages extends MessageTree>(
  i18n: I18n<Messages>,
): AngularTranslify<Messages> {
  return createRuntimeAngularI18n(i18n as I18n<MessageTree>) as AngularTranslify<Messages>;
}

export function provideTranslify(i18n: I18n<MessageTree>): EnvironmentProviders {
  return provideRuntimeTranslify(i18n);
}

export function injectTranslify<
  Messages extends MessageTree = MessageTree,
>(): AngularTranslify<Messages> {
  return injectRuntimeTranslify<Messages>() as AngularTranslify<Messages>;
}

export type { I18n, MessageTree, Translator };
