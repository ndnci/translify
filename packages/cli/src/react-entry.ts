'use client';

import { createElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  TranslifyProvider as RuntimeProvider,
  useI18n as useRuntimeI18n,
  useLocale as useRuntimeLocale,
  useTranslations as useRuntimeTranslations,
} from '@ndnci/translify-runtime/react';
import type { I18n, I18nProviderConfig, MessageTree, Translator } from '@ndnci/translify-runtime';

export type TranslifyProviderProps = I18nProviderConfig & { children: ReactNode };

export function TranslifyProvider(props: TranslifyProviderProps): ReactElement {
  return createElement(RuntimeProvider, props);
}

export function useI18n<Messages extends MessageTree = MessageTree>(): I18n<Messages> {
  return useRuntimeI18n<Messages>();
}

export function useLocale(): string {
  return useRuntimeLocale();
}

export function useTranslations(namespace?: string): Translator<MessageTree> {
  return useRuntimeTranslations(namespace);
}

export type { I18n, I18nProviderConfig, MessageTree, Translator };
