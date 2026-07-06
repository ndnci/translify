import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  BaseTranslationProvider,
  type TranslationRequest,
  type TranslationResponse,
} from './providers/base-provider.js';
import { translateMissingKeys, type TranslateProgressEvent } from './translator.js';

class FakeProvider extends BaseTranslationProvider {
  readonly name = 'fake';
  calls = 0;

  constructor(private readonly failOnCall?: number) {
    super();
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    this.calls += 1;
    if (this.failOnCall === this.calls) {
      throw new Error('simulated provider failure');
    }

    return {
      provider: this.name,
      translations: Object.fromEntries(
        Object.entries(request.entries).map(([key, value]) => [key, `${value} translated`]),
      ),
    };
  }
}

describe('translateMissingKeys', () => {
  it('emits per-file progress events with translated and total key counts', async () => {
    const events: TranslateProgressEvent[] = [];
    const cwd = '/tmp/translify-progress';

    await translateMissingKeys(new FakeProvider(), {
      defaultLanguage: 'en',
      batchSize: 1,
      dryRun: true,
      files: [
        {
          language: 'en',
          path: join(cwd, 'messages/en/common.json'),
          data: { hello: 'Hello', bye: 'Goodbye' },
        },
        {
          language: 'fr',
          path: join(cwd, 'messages/fr/common.json'),
          data: { hello: 'Bonjour' },
        },
      ],
      onProgress: (event) => events.push(event),
    });

    expect(events[0]).toEqual({
      type: 'start',
      files: [
        {
          language: 'fr',
          file: join(cwd, 'messages/fr/common.json'),
          translatedKeys: 0,
          totalKeys: 1,
        },
      ],
    });

    expect(events.map((event) => event.type)).toEqual([
      'start',
      'file-start',
      'file-progress',
      'file-complete',
      'complete',
    ]);

    expect(events.at(-1)).toEqual({
      type: 'complete',
      files: [
        {
          language: 'fr',
          file: join(cwd, 'messages/fr/common.json'),
          translatedKeys: 1,
          totalKeys: 1,
        },
      ],
    });
  });

  it('saves completed batches and resumes from checkpoint after a failed run', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'translify-resume-'));
    const messagesDir = join(cwd, 'messages');
    mkdirSync(messagesDir, { recursive: true });
    const checkpointPath = join(cwd, '.translify', 'translate-checkpoint.json');
    const targetPath = join(messagesDir, 'fr.json');
    const files = [
      {
        language: 'en',
        path: join(messagesDir, 'en.json'),
        data: { one: 'One', two: 'Two', three: 'Three' },
      },
      {
        language: 'fr',
        path: targetPath,
        data: {},
      },
    ];

    await expect(
      translateMissingKeys(new FakeProvider(2), {
        defaultLanguage: 'en',
        batchSize: 1,
        files,
        checkpoint: {
          path: checkpointPath,
          signature: 'same-command',
        },
      }),
    ).rejects.toThrow('simulated provider failure');

    expect(existsSync(checkpointPath)).toBe(true);
    expect(readFileSync(checkpointPath, 'utf8')).toContain('"one": "One translated"');

    const provider = new FakeProvider();
    await translateMissingKeys(provider, {
      defaultLanguage: 'en',
      batchSize: 1,
      files,
      checkpoint: {
        path: checkpointPath,
        signature: 'same-command',
        resume: true,
      },
    });

    expect(provider.calls).toBe(2);
    expect(existsSync(checkpointPath)).toBe(false);
    expect(JSON.parse(readFileSync(targetPath, 'utf8'))).toEqual({
      one: 'One translated',
      two: 'Two translated',
      three: 'Three translated',
    });
  });
});
