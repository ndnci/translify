import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveConfig, validateConfig } from '../resolver.js';
import { ConfigValidationError } from '@ndnci/translify-shared';

describe('validateConfig', () => {
  it('returns a fully defaulted config for an empty input', () => {
    const config = validateConfig({});
    expect(config.translations.default_language).toBe('en');
    expect(config.ai_translation.enabled).toBe(false);
    expect(config.ai_translation.model).toBe('gpt-5.6-luna');
    expect(Array.isArray(config.source.include)).toBe(true);
  });

  it('merges user values with defaults', () => {
    const config = validateConfig({
      translations: { default_language: 'fr', files: ['locales/*.json'] },
    });
    expect(config.translations.default_language).toBe('fr');
    expect(config.translations.files).toEqual(['locales/*.json']);
    expect(config.ai_translation.enabled).toBe(false);
  });

  it('throws ConfigValidationError when ai_translation is enabled without API key', () => {
    expect(() =>
      validateConfig({
        ai_translation: { enabled: true, provider: 'openai' },
      }),
    ).toThrow(ConfigValidationError);
  });

  it('passes when API key is provided with AI enabled', () => {
    const config = validateConfig({
      ai_translation: {
        enabled: true,
        provider: 'openai',
        openai_api_key: 'sk-test-key',
      },
    });
    expect(config.ai_translation.enabled).toBe(true);
    expect(config.ai_translation.openai_api_key).toBe('sk-test-key');
  });

  it('passes with OpenRouter when its API key is provided', () => {
    const config = validateConfig({
      ai_translation: {
        enabled: true,
        provider: 'openrouter',
        openrouter_api_key: 'sk-or-test-key',
        model: 'anthropic/claude-sonnet-4',
        verify: true,
        values_only: true,
      },
    });

    expect(config.ai_translation.provider).toBe('openrouter');
    expect(config.ai_translation.openrouter_api_key).toBe('sk-or-test-key');
    expect(config.ai_translation.verify).toBe(true);
    expect(config.ai_translation.values_only).toBe(true);
  });

  it('throws ConfigValidationError when OpenRouter is enabled without API key', () => {
    expect(() =>
      validateConfig({
        ai_translation: { enabled: true, provider: 'openrouter' },
      }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError with readable message on invalid temperature', () => {
    expect(() =>
      validateConfig({
        ai_translation: { temperature: 5 },
      }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError for unknown config keys', () => {
    expect(() =>
      validateConfig({
        translations: {
          default_language: 'en',
          files: ['messages/**/*.json'],
          typo_split: {},
        } as never,
      }),
    ).toThrow(ConfigValidationError);
  });

  it('accepts split options for multi-file translation projects', () => {
    const config = validateConfig({
      translations: {
        default_language: 'en',
        files: ['messages/**/*.json'],
        split: {
          depth: 1,
          groups: ['tools', { name: 'auth', match: ['auth', 'login'] }],
          output_pattern: 'messages/{language}/{group}.json',
        },
      },
    });

    expect(config.translations.split.depth).toBe(1);
    expect(config.translations.split.groups).toHaveLength(2);
  });

  it('defaults and validates centralized URL routing options', () => {
    const config = validateConfig({
      translations: { default_language: 'en' },
      routing: {
        locales: ['en', 'fr'],
        locale_prefix: 'as-needed',
        locale_detection: true,
        pathnames: {
          '/about': { en: '/about', fr: '/a-propos' },
        },
      },
    });

    expect(config.routing.locale_prefix).toBe('as-needed');
    expect(config.routing.locale_cookie).not.toBe(false);
    if (config.routing.locale_cookie) {
      expect(config.routing.locale_cookie.name).toBe('translify_locale');
    }
    expect(config.routing.pathnames['/about']).toEqual({ en: '/about', fr: '/a-propos' });
  });

  it('accepts centralized browser runtime defaults and bundled messages', () => {
    const config = validateConfig({
      translations: { default_language: 'en' },
      runtime: {
        locale: 'auto',
        missing_message: 'throw',
        time_zone: 'UTC',
        messages: { en: { home: { title: 'Hello' } }, fr: { home: { title: 'Bonjour' } } },
      },
    });

    expect(config.runtime.locale).toBe('auto');
    expect(config.runtime.missing_message).toBe('throw');
    expect(config.runtime.messages?.fr).toEqual({ home: { title: 'Bonjour' } });
  });

  it('loads .env files before evaluating config process.env references', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'translify-env-'));
    const envKey = 'TRANSLIFY_TEST_OPENAI_API_KEY';
    const previous = process.env[envKey];
    delete process.env[envKey];

    writeFileSync(join(cwd, '.env'), `${envKey}=sk-from-env\n`, 'utf8');
    writeFileSync(join(cwd, '.env.local'), `${envKey}=sk-from-env-local\n`, 'utf8');
    writeFileSync(
      join(cwd, 'translify.config.js'),
      `
        export default {
          ai_translation: {
            enabled: true,
            provider: 'openai',
            openai_api_key: process.env.${envKey},
          },
        };
      `,
      'utf8',
    );

    try {
      const { config } = await resolveConfig({ cwd });
      expect(config.ai_translation.openai_api_key).toBe('sk-from-env-local');
    } finally {
      if (previous === undefined) {
        delete process.env[envKey];
      } else {
        process.env[envKey] = previous;
      }
    }
  });

  it('keeps existing shell environment variables over .env files', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'translify-env-'));
    const envKey = 'TRANSLIFY_TEST_OPENROUTER_API_KEY';
    const previous = process.env[envKey];
    process.env[envKey] = 'sk-from-shell';

    writeFileSync(join(cwd, '.env'), `${envKey}=sk-from-env\n`, 'utf8');
    writeFileSync(
      join(cwd, 'translify.config.js'),
      `
        export default {
          ai_translation: {
            enabled: true,
            provider: 'openrouter',
            openrouter_api_key: process.env.${envKey},
          },
        };
      `,
      'utf8',
    );

    try {
      const { config } = await resolveConfig({ cwd });
      expect(config.ai_translation.openrouter_api_key).toBe('sk-from-shell');
    } finally {
      if (previous === undefined) {
        delete process.env[envKey];
      } else {
        process.env[envKey] = previous;
      }
    }
  });
});
