import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createServerI18n, getServerTranslations } from '../server-entry.js';

function createProject(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'translify-server-'));
  mkdirSync(join(cwd, 'messages', 'en'), { recursive: true });
  mkdirSync(join(cwd, 'messages', 'fr'), { recursive: true });
  writeFileSync(
    join(cwd, 'translify.config.json'),
    JSON.stringify({
      translations: { default_language: 'en', files: ['messages/**/*.json'] },
      routing: { locales: ['en', 'fr'], locale_prefix: 'as-needed' },
    }),
  );
  writeFileSync(
    join(cwd, 'messages', 'en', 'common.json'),
    JSON.stringify({ Home: { title: 'Hello {name}', fallback: 'English only' } }),
  );
  writeFileSync(
    join(cwd, 'messages', 'fr', 'common.json'),
    JSON.stringify({ Home: { title: 'Bonjour {name}' } }),
  );
  return cwd;
}

describe('server runtime', () => {
  it('loads config and split catalogues without repeating runtime configuration', async () => {
    const cwd = createProject();
    const i18n = await createServerI18n({ cwd, locale: 'fr' });

    expect(i18n.locale).toBe('fr');
    expect(i18n.t('Home.title', { name: 'Ada' })).toBe('Bonjour Ada');
    expect(i18n.t('Home.fallback')).toBe('English only');
  });

  it('detects each HTTP request independently and exposes a direct translator helper', async () => {
    const cwd = createProject();
    const frenchRequest = new Request('https://example.com/', {
      headers: { 'accept-language': 'fr-FR,fr;q=0.9' },
    });
    const englishRequest = new Request('https://example.com/');

    const [french, english, home] = await Promise.all([
      createServerI18n({ cwd, request: frenchRequest }),
      createServerI18n({ cwd, request: englishRequest }),
      getServerTranslations({ cwd, locale: 'fr', namespace: 'Home' }),
    ]);

    expect(french.t('Home.title', { name: 'Lin' })).toBe('Bonjour Lin');
    expect(english.t('Home.title', { name: 'Lin' })).toBe('Hello Lin');
    expect(home('title', { name: 'Sam' })).toBe('Bonjour Sam');
  });
});
