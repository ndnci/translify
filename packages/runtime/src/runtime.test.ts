import { describe, expect, it, vi } from 'vitest';
import { createI18n, createI18nFromConfig, detectLocale } from './index.js';

const messages = {
  en: {
    Home: {
      title: 'Hello {name}',
      followers: '{count, plural, =0 {No followers} one {# follower} other {# followers}}',
      role: '{role, select, admin {Administrator} other {Member}}',
      published: 'Published on {date, date, short}',
    },
    flat: 'English flat value',
  },
  fr: {
    Home: {
      title: 'Bonjour {name}',
      followers: '{count, plural, =0 {Aucun abonné} one {# abonné} other {# abonnés}}',
      role: '{role, select, admin {Administrateur} other {Membre}}',
    },
    'flat.key': 'Valeur plate',
  },
} as const;

describe('createI18n', () => {
  it('formats nested, flat, namespaced, plural and select messages with ICU syntax', () => {
    const i18n = createI18n({ locale: 'fr', defaultLocale: 'en', messages });
    const home = i18n.getTranslator('Home');

    expect(home('title', { name: 'Ada' })).toBe('Bonjour Ada');
    expect(home('followers', { count: 0 })).toBe('Aucun abonné');
    expect(home('followers', { count: 2 })).toBe('2 abonnés');
    expect(home('role', { role: 'admin' })).toBe('Administrateur');
    expect(i18n.t('flat.key')).toBe('Valeur plate');
  });

  it('falls back per message through the base locale and default locale', () => {
    const i18n = createI18n({
      locale: 'fr-CA',
      defaultLocale: 'en',
      messages: {
        ...messages,
        'fr-CA': { Home: { title: 'Allô {name}' } },
      },
      timeZone: 'UTC',
    });

    expect(i18n.t('Home.title', { name: 'Lin' })).toBe('Allô Lin');
    expect(i18n.t('Home.followers', { count: 3 })).toBe('3 abonnés');
    expect(i18n.t('Home.published', { date: new Date('2024-01-15T12:00:00Z') })).toBe(
      'Published on 24-01-15',
    );
  });

  it('changes locale reactively without leaking state across instances', () => {
    const first = createI18n({ locale: 'en', defaultLocale: 'en', messages });
    const second = createI18n({ locale: 'en', defaultLocale: 'en', messages });
    const listener = vi.fn();
    const unsubscribe = first.subscribe(listener);

    first.setLocale('fr');
    expect(first.locale).toBe('fr');
    expect(first.t('Home.title', { name: 'Sam' })).toBe('Bonjour Sam');
    expect(second.locale).toBe('en');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    first.setLocale('en');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports predictable missing-message behavior and blocks prototype paths', () => {
    const onError = vi.fn();
    const i18n = createI18n({
      locale: 'fr',
      defaultLocale: 'en',
      messages,
      missingMessage: 'key',
      onError,
    });

    expect(i18n.t('Home.unknown' as never)).toBe('Home.unknown');
    expect(i18n.has('__proto__.polluted' as never)).toBe(false);
    expect(i18n.raw('constructor.prototype' as never)).toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('formats numbers, dates, lists and relative time using the active locale', () => {
    const i18n = createI18n({
      locale: 'en',
      defaultLocale: 'en',
      messages,
      timeZone: 'UTC',
    });

    expect(i18n.formatNumber(1234.5, { maximumFractionDigits: 1 })).toBe('1,234.5');
    expect(i18n.formatDate(new Date('2024-01-15T12:00:00Z'), { dateStyle: 'medium' })).toBe(
      'Jan 15, 2024',
    );
    expect(i18n.formatList(['Ada', 'Lin', 'Grace'])).toBe('Ada, Lin, and Grace');
    expect(i18n.formatRelativeTime(-1, 'day')).toBe('yesterday');
  });
});

describe('configuration helpers', () => {
  it('reuses the default language from translify.config', () => {
    const i18n = createI18nFromConfig(
      { translations: { default_language: 'en' } },
      { locale: 'fr', messages },
    );

    expect(i18n.defaultLocale).toBe('en');
    expect(i18n.t('Home.title', { name: 'Ada' })).toBe('Bonjour Ada');
  });

  it('detects the closest supported browser locale deterministically', () => {
    expect(detectLocale(['en', 'fr', 'pt-BR'], 'en', ['fr-CA', 'de'])).toBe('fr');
    expect(detectLocale(['en', 'fr', 'pt-BR'], 'en', ['pt-PT'])).toBe('en');
  });
});
