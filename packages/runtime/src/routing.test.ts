import { describe, expect, it } from 'vitest';
import { createI18nRouter } from './routing.js';

const config = {
  translations: { default_language: 'en' },
  routing: {
    locales: ['en', 'fr', 'de'],
    locale_prefix: 'as-needed' as const,
    locale_detection: true,
    locale_cookie: { name: 'site_locale' },
    pathnames: {
      '/': '/',
      '/about': { en: '/about', fr: '/a-propos', de: '/uber-uns' },
      '/blog/[slug]': {
        en: '/blog/[slug]',
        fr: '/actualites/[slug]',
        de: '/neuigkeiten/[slug]',
      },
    },
  },
};

describe('createI18nRouter', () => {
  it('creates localized URLs without prefixing the default locale', () => {
    const router = createI18nRouter(config);

    expect(router.href('/about', 'en')).toBe('/about');
    expect(router.href('/about', 'fr')).toBe('/fr/a-propos');
    expect(router.href('/blog/hello-world?draft=1#comments', 'de')).toBe(
      '/de/neuigkeiten/hello-world?draft=1#comments',
    );
  });

  it('resolves translated paths back to one internal pathname', () => {
    const router = createI18nRouter(config);
    const route = router.resolve('https://example.com/fr/actualites/bonjour?preview=1');

    expect(route.locale).toBe('fr');
    expect(route.pathname).toBe('/blog/bonjour');
    expect(route.params).toEqual({ slug: 'bonjour' });
    expect(route.redirect).toBeUndefined();
  });

  it('redirects an unprefixed visit using cookie then Accept-Language detection', () => {
    const router = createI18nRouter(config);

    expect(
      router.resolve('https://example.com/about', {
        headers: { cookie: 'site_locale=de', 'accept-language': 'fr-FR,fr;q=0.9' },
      }).redirect,
    ).toBe('https://example.com/de/uber-uns');

    expect(
      router.resolve('https://example.com/about', {
        headers: { 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.7' },
      }).redirect,
    ).toBe('https://example.com/fr/a-propos');
  });

  it('supports always-prefixed and prefix-free URL strategies', () => {
    const always = createI18nRouter({
      ...config,
      routing: { ...config.routing, locale_prefix: 'always' },
    });
    const never = createI18nRouter({
      ...config,
      routing: { ...config.routing, locale_prefix: 'never' },
    });

    expect(always.href('/about', 'en')).toBe('/en/about');
    expect(never.href('/about', 'fr')).toBe('/a-propos');
    expect(never.resolve('https://example.com/a-propos').locale).toBe('fr');
  });

  it('switches locale and emits canonical alternate links', () => {
    const router = createI18nRouter(config);

    expect(router.switchLocale('/fr/actualites/article?ref=nav', 'de')).toBe(
      '/de/neuigkeiten/article?ref=nav',
    );
    expect(router.alternates('/about', 'https://example.com')).toEqual([
      { locale: 'en', href: 'https://example.com/about' },
      { locale: 'fr', href: 'https://example.com/fr/a-propos' },
      { locale: 'de', href: 'https://example.com/de/uber-uns' },
      { locale: 'x-default', href: 'https://example.com/about' },
    ]);
  });
});
