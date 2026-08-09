import { createNextI18n } from '@ndnci/translify/next';
import config from '../../translify.config';

const loaders = {
  en: () => import('../../messages/en.json').then((module) => module.default),
  fr: () => import('../../messages/fr.json').then((module) => module.default),
} as const;

export const i18n = createNextI18n({
  config,
  locales: ['en', 'fr'] as const,
  loadMessages: async (locale) => loaders[locale](),
  timeZone: 'UTC',
});
