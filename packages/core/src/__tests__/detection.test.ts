import { describe, it, expect } from 'vitest';
import { detectUnusedKeys } from '../detection/unused-detector.js';
import { detectMissingKeys } from '../detection/missing-detector.js';
import { detectDuplicateValues } from '../detection/duplicate-detector.js';
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
