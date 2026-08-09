'use client';

import { createContext, createElement, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createI18n } from './runtime.js';
import type { I18n, MessageTree, I18nProviderConfig, Translator } from './types.js';

const TranslifyContext = createContext<I18n<MessageTree> | null>(null);

export type TranslifyProviderProps = I18nProviderConfig & {
  children: ReactNode;
};

export function TranslifyProvider(props: TranslifyProviderProps) {
  const i18n = useMemo(() => {
    if (props.i18n) return props.i18n;
    return createI18n({
      ...(props.config !== undefined && { config: props.config }),
      ...(props.useConfig !== undefined && { useConfig: props.useConfig }),
      ...(props.locale && { locale: props.locale }),
      ...(props.defaultLocale && { defaultLocale: props.defaultLocale }),
      ...(props.messages && { messages: props.messages }),
      ...(props.missingMessage && { missingMessage: props.missingMessage }),
      ...(props.timeZone && { timeZone: props.timeZone }),
    });
  }, [
    props.defaultLocale,
    props.config,
    props.i18n,
    props.locale,
    props.messages,
    props.missingMessage,
    props.timeZone,
    props.useConfig,
  ]);

  return createElement(TranslifyContext.Provider, { value: i18n }, props.children);
}

export function useI18n<Messages extends MessageTree = MessageTree>(): I18n<Messages> {
  const i18n = useContext(TranslifyContext);
  if (!i18n) {
    throw new Error('Translify hooks must be used inside <TranslifyProvider>');
  }

  useSyncExternalStore(
    i18n.subscribe,
    () => i18n.revision,
    () => i18n.revision,
  );
  return i18n as I18n<Messages>;
}

export function useLocale(): string {
  return useI18n().locale;
}

export function useTranslations(namespace?: string): Translator<MessageTree> {
  const i18n = useI18n();
  return useMemo(
    () => (namespace ? i18n.getTranslator(namespace) : i18n.t),
    [i18n, i18n.revision, namespace],
  );
}

export type { I18n, MessageTree, Translator } from './types.js';
