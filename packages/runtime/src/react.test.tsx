import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createI18n } from './index.js';
import { TranslifyProvider, useLocale, useTranslations } from './react.js';

describe('React integration', () => {
  it('provides a namespaced translator and locale during server rendering', () => {
    const i18n = createI18n({
      locale: 'fr',
      defaultLocale: 'en',
      messages: {
        en: { Hero: { title: 'Hello {name}' } },
        fr: { Hero: { title: 'Bonjour {name}' } },
      },
    });

    function Hero() {
      const t = useTranslations('Hero');
      const locale = useLocale();
      return <h1 lang={locale}>{t('title', { name: 'Ada' })}</h1>;
    }

    expect(
      renderToString(
        <TranslifyProvider i18n={i18n}>
          <Hero />
        </TranslifyProvider>,
      ),
    ).toContain('<h1 lang="fr">Bonjour Ada</h1>');
  });

  it('throws a clear error when a hook is used outside the provider', () => {
    function Invalid() {
      useTranslations();
      return null;
    }

    expect(() => renderToString(<Invalid />)).toThrow(
      'Translify hooks must be used inside <TranslifyProvider>',
    );
  });

  it('creates an isolated provider from serializable Next.js props', () => {
    function Title() {
      return <span>{useTranslations('Hero')('title', { name: 'Lin' })}</span>;
    }

    expect(
      renderToString(
        <TranslifyProvider
          locale="fr"
          defaultLocale="en"
          messages={{
            en: { Hero: { title: 'Hello {name}' } },
            fr: { Hero: { title: 'Salut {name}' } },
          }}
        >
          <Title />
        </TranslifyProvider>,
      ),
    ).toContain('<span>Salut Lin</span>');
  });
});
