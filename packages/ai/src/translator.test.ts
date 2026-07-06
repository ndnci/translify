import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  BaseTranslationProvider,
  type TranslationRequest,
  type TranslationResponse,
} from './providers/base-provider.js';
import { translateMissingKeys, type TranslateProgressEvent } from './translator.js';

class FakeProvider extends BaseTranslationProvider {
  readonly name = 'fake';

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
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
});
