import { describe, expect, it, vi } from 'vitest';
import { createNextI18n } from './next.js';

describe('createNextI18n', () => {
  it('loads isolated request translators and falls back to the configured default locale', async () => {
    const loadMessages = vi.fn(async (locale: string) => {
      if (locale === 'fr') return { Page: { title: 'Bonjour', onlyFrench: 'France' } };
      return { Page: { title: 'Hello', fallback: 'Fallback' } };
    });
    const nextI18n = createNextI18n({
      config: { translations: { default_language: 'en' } },
      locales: ['en', 'fr'] as const,
      loadMessages,
    });

    const french = await nextI18n.getTranslations({ locale: 'fr', namespace: 'Page' });
    const invalid = await nextI18n.getTranslations({ locale: 'not-a-locale', namespace: 'Page' });

    expect(french('title')).toBe('Bonjour');
    expect(french('fallback' as never)).toBe('Fallback');
    expect(invalid('title')).toBe('Hello');
    expect(nextI18n.generateStaticParams()).toEqual([{ locale: 'en' }, { locale: 'fr' }]);
    expect(nextI18n.isLocale('fr')).toBe(true);
    expect(nextI18n.isLocale('es')).toBe(false);
    expect(nextI18n.isLocale('fr-CA')).toBe(false);
    expect(nextI18n.resolveLocale('fr-CA')).toBe('fr');
    await expect(nextI18n.getClientConfig('fr')).resolves.toEqual({
      locale: 'fr',
      defaultLocale: 'en',
      messages: {
        en: { Page: { title: 'Hello', fallback: 'Fallback' } },
        fr: { Page: { title: 'Bonjour', onlyFrench: 'France' } },
      },
    });
  });

  it('does not share mutable locale state between concurrent requests', async () => {
    const nextI18n = createNextI18n({
      config: { translations: { default_language: 'en' } },
      locales: ['en', 'fr'] as const,
      loadMessages: async (locale) => ({ value: locale }),
    });

    const [english, french] = await Promise.all([nextI18n.getI18n('en'), nextI18n.getI18n('fr')]);

    expect(english.t('value')).toBe('en');
    expect(french.t('value')).toBe('fr');
    french.setLocale('en');
    expect(english.locale).toBe('en');
  });

  it('uses routing locales from config without repeating them', async () => {
    const nextI18n = createNextI18n({
      config: {
        translations: { default_language: 'en' },
        routing: { locales: ['en', 'fr'] as const },
      },
      loadMessages: async (locale: 'en' | 'fr') => ({ value: locale }),
    });

    expect(nextI18n.locales).toEqual(['en', 'fr']);
    expect((await nextI18n.getTranslations({ locale: 'fr' }))('value')).toBe('fr');
  });
});
