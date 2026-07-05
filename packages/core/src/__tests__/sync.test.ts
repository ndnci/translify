import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { syncTranslationFiles } from '../sync/translation-sync.js';
import { loadTranslationFile } from '../sync/translation-sync.js';

describe('syncTranslationFiles (surgical writes)', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('preserves 4-space indentation and leaves untouched namespaces byte-identical', () => {
    dir = mkdtempSync(join(tmpdir(), 'translify-sync-'));
    const enPath = join(dir, 'en.json');
    const original = [
      '{',
      '    "home": {',
      '        "title": "Home"',
      '    },',
      '    "about": {',
      '        "title": "About us",',
      '        "mission": "Our mission"',
      '    }',
      '}',
      '',
    ].join('\n');
    writeFileSync(enPath, original, 'utf8');

    const enFile = loadTranslationFile(enPath);

    syncTranslationFiles({
      extractedKeys: new Set(['home.title', 'home.subtitle', 'about.title', 'about.mission']),
      files: [enFile],
      defaultLanguage: 'en',
    });

    const updated = readFileSync(enPath, 'utf8');

    // The untouched "about" block must be byte-identical, comma and all.
    expect(updated).toContain(
      '    "about": {\n        "title": "About us",\n        "mission": "Our mission"\n    }',
    );
    // The new key is inserted with matching 4-space (2-level = 8-space) indentation.
    expect(updated).toContain('        "subtitle": "');
    expect(JSON.parse(updated)).toEqual({
      home: { title: 'Home', subtitle: '' },
      about: { title: 'About us', mission: 'Our mission' },
    });
  });

  it('preserves tab indentation', () => {
    dir = mkdtempSync(join(tmpdir(), 'translify-sync-'));
    const enPath = join(dir, 'en.json');
    const original = ['{', '\t"greeting": "Hello"', '}', ''].join('\n');
    writeFileSync(enPath, original, 'utf8');

    const enFile = loadTranslationFile(enPath);

    syncTranslationFiles({
      extractedKeys: new Set(['greeting', 'farewell']),
      files: [enFile],
      defaultLanguage: 'en',
    });

    const updated = readFileSync(enPath, 'utf8');
    expect(updated).toContain('\t"greeting": "Hello"');
    expect(updated).toContain('\t"farewell": "');
    expect(JSON.parse(updated)).toEqual({ greeting: 'Hello', farewell: '' });
  });
});
