import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { BaseTranslationProvider } from '@ndnci/translify-ai';
import { createStudioService, groupTranslationFiles, studioHtml } from '../studio/index.js';

describe('studio translation catalogue', () => {
  it('groups equivalent locale files into one sidebar item', () => {
    const cwd = '/project';
    const groups = groupTranslationFiles(
      [
        { path: '/project/messages/en/common.json', language: 'en', data: {} },
        { path: '/project/messages/fr/common.json', language: 'fr', data: {} },
        { path: '/project/messages/en/auth.json', language: 'en', data: {} },
        { path: '/project/messages/fr/auth.json', language: 'fr', data: {} },
      ],
      cwd,
    );

    expect(groups.map((group) => group.id)).toEqual(['messages/auth.json', 'messages/common.json']);
    expect(groups[1]?.files).toEqual({
      en: '/project/messages/en/common.json',
      fr: '/project/messages/fr/common.json',
    });
  });

  it('reads aligned source/target entries and surgically updates one value', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'translify-studio-'));
    mkdirSync(join(cwd, 'messages', 'en'), { recursive: true });
    mkdirSync(join(cwd, 'messages', 'fr'), { recursive: true });
    writeFileSync(
      join(cwd, 'messages', 'en', 'common.json'),
      '{\n    "home": { "title": "Hello" }\n}\n',
    );
    writeFileSync(
      join(cwd, 'messages', 'fr', 'common.json'),
      '{\n    "home": { "title": "Bonjour" }\n}\n',
    );

    const service = await createStudioService({
      cwd,
      config: {
        translations: {
          default_language: 'en',
          files: ['messages/**/*.json'],
          split: { depth: 1, groups: [], group_match: 'keys' },
        },
        ai_translation: {
          enabled: true,
          provider: 'openrouter',
          openrouter_api_key: 'test',
          model: 'test-model',
          temperature: 0,
          batch_size: 50,
          verify: false,
          values_only: false,
        },
      },
    });

    const group = service.metadata.groups[0]!;
    expect(service.entries(group.id, 'fr')).toEqual([
      { key: 'home.title', source: 'Hello', target: 'Bonjour', missing: false },
    ]);

    service.update(group.id, 'fr', 'home.title', 'Salut');
    expect(readFileSync(join(cwd, 'messages', 'fr', 'common.json'), 'utf8')).toBe(
      '{\n    "home": { "title": "Salut" }\n}\n',
    );
  });
});

describe('studio AI translations', () => {
  it('returns between one and ten suggestions with aggregate usage', async () => {
    const translate = vi.fn(async ({ entries }: { entries: Record<string, string> }) => ({
      translations: Object.fromEntries(
        Object.keys(entries).map((key, index) => [key, `Suggestion ${index + 1}`]),
      ),
      provider: 'fake',
      usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20, costUsd: 0.0002 },
    }));
    const provider = { translate } as unknown as BaseTranslationProvider;
    const service = await createStudioService({
      cwd: '/project',
      config: {
        translations: {
          default_language: 'en',
          files: [],
          split: { depth: 1, groups: [], group_match: 'keys' },
        },
        ai_translation: {
          enabled: true,
          provider: 'openrouter',
          openrouter_api_key: 'test',
          model: 'test-model',
          temperature: 0,
          batch_size: 50,
          verify: false,
          values_only: false,
        },
      },
      provider,
    });

    const result = await service.translate({
      text: 'Hello',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      suggestions: 3,
      candidate: 'Bonjour',
    });

    expect(result.translations).toEqual(['Suggestion 1', 'Suggestion 2', 'Suggestion 3']);
    expect(result.usage).toEqual({
      promptTokens: 12,
      completionTokens: 8,
      totalTokens: 20,
      costUsd: 0.0002,
    });
    expect(translate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        instructions: expect.stringContaining('Bonjour'),
      }),
    );
  });

  it('rejects invalid suggestion counts', async () => {
    const service = await createStudioService({
      cwd: '/project',
      config: {
        translations: {
          default_language: 'en',
          files: [],
          split: { depth: 1, groups: [], group_match: 'keys' },
        },
        ai_translation: {
          enabled: false,
          provider: 'openai',
          model: 'gpt-4.1-mini',
          temperature: 0,
          batch_size: 50,
          verify: false,
          values_only: false,
        },
      },
    });

    await expect(
      service.translate({
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        suggestions: 11,
      }),
    ).rejects.toThrow('between 1 and 10');
  });
});

describe('studio UI', () => {
  it('ships the translator, catalogue filters, edit action, AI modal and Tabler icons', () => {
    expect(studioHtml).toContain('data-view="translator"');
    expect(studioHtml).toContain('data-view="catalogue"');
    expect(studioHtml).toContain('id="language-select"');
    expect(studioHtml).toContain('id="translation-search"');
    expect(studioHtml).toContain('id="ai-modal"');
    expect(studioHtml).toContain('tabler-icon');
    expect(studioHtml).toContain('Regenerate');
  });
});
