import { describe, it, expect } from 'vitest';
import {
  flattenTranslations,
  unflattenTranslations,
  sortTranslationKeys,
  matchesAnyPattern,
  extractLanguageFromPath,
} from '../utils/index.js';

describe('flattenTranslations', () => {
  it('flattens nested objects into dot-notation', () => {
    const input = {
      home: {
        title: 'Hello',
        nav: { back: 'Back' },
      },
      global: { ok: 'OK' },
    };
    expect(flattenTranslations(input)).toEqual({
      'home.title': 'Hello',
      'home.nav.back': 'Back',
      'global.ok': 'OK',
    });
  });

  it('handles flat objects unchanged', () => {
    expect(flattenTranslations({ a: 'A', b: 'B' })).toEqual({ a: 'A', b: 'B' });
  });
});

describe('unflattenTranslations', () => {
  it('rebuilds nested objects from dot-notation', () => {
    const input = { 'home.title': 'Hello', 'home.nav.back': 'Back' };
    expect(unflattenTranslations(input)).toEqual({
      home: { title: 'Hello', nav: { back: 'Back' } },
    });
  });
});

describe('sortTranslationKeys', () => {
  it('sorts keys alphabetically at each level', () => {
    const keys = Object.keys(sortTranslationKeys({ z: '1', a: '2', m: '3' }));
    expect(keys).toEqual(['a', 'm', 'z']);
  });
});

describe('matchesAnyPattern', () => {
  it('returns true when a pattern matches', () => {
    expect(matchesAnyPattern('v1.2.3', ['^v\\d+'])).toBe(true);
  });

  it('returns false when no pattern matches', () => {
    expect(matchesAnyPattern('home.title', ['^v\\d+', '^\\d+$'])).toBe(false);
  });
});

describe('extractLanguageFromPath', () => {
  it('extracts language from file path', () => {
    expect(extractLanguageFromPath('messages/en.json')).toBe('en');
    expect(extractLanguageFromPath('locales/pt-BR.json')).toBe('pt-BR');
  });
});
