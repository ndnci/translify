import { describe, it, expect } from 'vitest';
import { upgradeJavaScriptConfig, upgradeJsonConfig } from '../commands/config-upgrade.js';

describe('config-upgrade', () => {
  it('adds new ai_translation keys without replacing existing values', () => {
    const source = `export default {
  ai_translation: {
    enabled: true,
    provider: 'openai',
    openai_api_key: process.env.CUSTOM_OPENAI_KEY,
    model: 'gpt-4.1',
  },
};
`;

    const result = upgradeJavaScriptConfig(source);

    expect(result.content).toContain('openai_api_key: process.env.CUSTOM_OPENAI_KEY');
    expect(result.content).toContain('openrouter_api_key: process.env.OPENROUTER_API_KEY');
    expect(result.content).toContain('batch_size: 50');
    expect(result.content).toContain('verify: false');
    expect(result.content).toContain('values_only: false');
    expect(result.content).toContain("model: 'gpt-4.1'");
  });

  it('adds missing top-level sections to JavaScript configs', () => {
    const source = `export default {
  translations: {
    default_language: 'fr',
  },
};
`;

    const result = upgradeJavaScriptConfig(source);

    expect(result.content).toContain('source: {');
    expect(result.content).toContain('detection: {');
    expect(result.content).toContain('routing: {');
    expect(result.content).toContain("locale_prefix: 'as-needed'");
    expect(result.content).toContain('ai_translation: {');
    expect(result.content).toContain("default_language: 'fr'");
    expect(result.content).toContain("files: ['messages/**/*.json']");
  });

  it('adds missing JSON config paths without overwriting existing values', () => {
    const source = JSON.stringify(
      {
        ai_translation: {
          enabled: true,
          provider: 'openrouter',
          openrouter_api_key: '${OPENROUTER_API_KEY}',
          model: 'anthropic/claude-sonnet-4',
        },
      },
      null,
      2,
    );

    const result = upgradeJsonConfig(source);
    const parsed = JSON.parse(result.content) as {
      ai_translation: Record<string, unknown>;
      routing: Record<string, unknown>;
    };

    expect(parsed.ai_translation.provider).toBe('openrouter');
    expect(parsed.ai_translation.model).toBe('anthropic/claude-sonnet-4');
    expect(parsed.ai_translation.batch_size).toBe(50);
    expect(parsed.ai_translation.verify).toBe(false);
    expect(parsed.ai_translation.values_only).toBe(false);
    expect(parsed.routing.locale_detection).toBe(true);
  });
});
