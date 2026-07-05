import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { detectUnusedKeys } from '../detection/unused-detector.js';
import { detectMissingKeys } from '../detection/missing-detector.js';
import { detectDuplicateValues } from '../detection/duplicate-detector.js';
import { detectDuplicateKeys } from '../detection/duplicate-key-detector.js';
import { detectLocaleInconsistencies } from '../detection/consistency-detector.js';
import type { TranslationFile, ExtractionEntry } from '@ndnci/translify-shared';

const enFile: TranslationFile = {
  language: 'en',
  path: '/messages/en.json',
  data: {
    home: { title: 'Home', description: 'Welcome' },
    about: { title: 'About' },
    unused: { key: 'Unused value' },
    dup: { a: 'Same text', b: 'Same text' },
  },
};

const entries: ExtractionEntry[] = [
  { key: 'home.title', file: 'src/page.tsx', line: 5, column: 0, type: 'translation-call' },
  { key: 'home.description', file: 'src/page.tsx', line: 6, column: 0, type: 'translation-call' },
  { key: 'about.title', file: 'src/about.tsx', line: 3, column: 0, type: 'translation-call' },
  { key: 'missing.key', file: 'src/other.tsx', line: 10, column: 0, type: 'translation-call' },
];

const usedKeys = new Set(entries.map((e) => e.key));

describe('detectUnusedKeys', () => {
  it('finds keys in translation file not in used keys', () => {
    const results = detectUnusedKeys([enFile], usedKeys);
    const keys = results.map((r) => r.key);
    expect(keys).toContain('unused.key');
    expect(keys).toContain('dup.a');
    expect(keys).toContain('dup.b');
    expect(keys).not.toContain('home.title');
  });
});

describe('detectMissingKeys', () => {
  it('finds keys used in code but absent from translation file', () => {
    const results = detectMissingKeys([enFile], entries);
    const keys = results.map((r) => r.key);
    expect(keys).toContain('missing.key');
    expect(keys).not.toContain('home.title');
  });
});

describe('detectDuplicateValues', () => {
  it('finds keys sharing the same value', () => {
    const results = detectDuplicateValues([enFile]);
    const dup = results.find((r) => r.value === 'Same text');
    expect(dup).toBeDefined();
    expect(dup!.keys).toContain('dup.a');
    expect(dup!.keys).toContain('dup.b');
  });

  it('does not flag unique values', () => {
    const results = detectDuplicateValues([enFile]);
    const titles = results.find((r) => r.value === 'Home');
    expect(titles).toBeUndefined();
  });
});

describe('detectDuplicateKeys', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('finds literal duplicate keys that JSON.parse silently drops', () => {
    dir = mkdtempSync(join(tmpdir(), 'translify-dupkey-'));
    const path = join(dir, 'en.json');
    writeFileSync(
      path,
      ['{', '  "home": {', '    "title": "Home",', '    "title": "Home page"', '  }', '}'].join(
        '\n',
      ),
      'utf8',
    );

    const file: TranslationFile = {
      language: 'en',
      path,
      data: JSON.parse(readFileSync(path, 'utf8')),
    };

    const results = detectDuplicateKeys([file]);
    expect(results).toHaveLength(1);
    expect(results[0]!.key).toBe('home.title');
    expect(results[0]!.occurrences).toHaveLength(2);
  });

  it('does not flag keys declared once', () => {
    dir = mkdtempSync(join(tmpdir(), 'translify-dupkey-'));
    const path = join(dir, 'en.json');
    writeFileSync(path, '{\n  "home": {\n    "title": "Home"\n  }\n}\n', 'utf8');

    const file: TranslationFile = { language: 'en', path, data: { home: { title: 'Home' } } };

    expect(detectDuplicateKeys([file])).toHaveLength(0);
  });
});

describe('detectLocaleInconsistencies', () => {
  const en: TranslationFile = {
    language: 'en',
    path: '/messages/en.json',
    data: { home: { title: 'Home', subtitle: 'Welcome' }, about: { title: 'About' } },
  };
  const fr: TranslationFile = {
    language: 'fr',
    path: '/messages/fr.json',
    data: { home: { title: 'Accueil' }, about: { title: 'À propos' } },
  };

  it('flags keys present in the default language but missing from another locale', () => {
    const results = detectLocaleInconsistencies([en, fr], 'en');
    const subtitle = results.find((r) => r.key === 'home.subtitle');
    expect(subtitle).toBeDefined();
    expect(subtitle!.missingIn).toEqual(['fr']);
    expect(subtitle!.presentIn).toEqual(['en']);
  });

  it('does not flag keys present in every locale', () => {
    const results = detectLocaleInconsistencies([en, fr], 'en');
    expect(results.find((r) => r.key === 'home.title')).toBeUndefined();
    expect(results.find((r) => r.key === 'about.title')).toBeUndefined();
  });

  it('returns nothing for a single-locale project', () => {
    expect(detectLocaleInconsistencies([en], 'en')).toEqual([]);
  });
});
