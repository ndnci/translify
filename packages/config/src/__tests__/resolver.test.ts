import { describe, it, expect } from 'vitest';
import { validateConfig } from '../resolver.js';
import { ConfigValidationError } from '@ndnci/translify-shared';

describe('validateConfig', () => {
  it('returns a fully defaulted config for an empty input', () => {
    const config = validateConfig({});
    expect(config.translations.default_language).toBe('en');
    expect(config.ai_translation.enabled).toBe(false);
    expect(config.ai_translation.model).toBe('gpt-4.1-mini');
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
});
