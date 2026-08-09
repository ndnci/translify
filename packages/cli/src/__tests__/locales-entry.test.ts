import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  LANGUAGES,
  LOCALE_DATA_SOURCES,
  formatDateForCountry,
  getCountry,
  getCountryWithLanguages,
  getLanguage,
} from '../locales-entry.js';

describe('built-in world locale data', () => {
  it('exports every ISO 3166-1 country and the full ISO 639-3 registry', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(249);
    expect(LANGUAGES.length).toBeGreaterThan(7_800);
    expect(new Set(COUNTRIES.map((country) => country.code.alpha2)).size).toBe(COUNTRIES.length);
    expect(new Set(LANGUAGES.map((language) => language.iso6393)).size).toBe(LANGUAGES.length);
  });

  it('includes detailed country, date, week, timezone and locale metadata', () => {
    const france = getCountry('FR');

    expect(france).toMatchObject({
      code: { alpha2: 'FR', alpha3: 'FRA', numeric: '250' },
      flag: '🇫🇷',
      region: 'Europe',
      currencies: { EUR: expect.objectContaining({ symbol: '€' }) },
      week: { firstDay: 'mon', weekend: { start: 'sat', end: 'sun' } },
      measurementSystem: 'metric',
    });
    expect(france?.callingCodes).toContain('+33');
    expect(france?.timeZones).toContain('Europe/Paris');
    expect(france?.dateFormats.short.example).toBeTruthy();
    expect(france?.dateFormats.short.order).toEqual(['day', 'month', 'year']);
    expect(formatDateForCountry(new Date('2001-11-23T12:00:00Z'), 'FR', 'short')).toBe(
      france?.dateFormats.short.example,
    );
  });

  it('keeps language records normalized while covering minority languages', () => {
    expect(getLanguage('av')).toMatchObject({ iso6391: 'av', iso6393: 'ava', name: 'Avaric' });
    expect(getLanguage('lez')).toMatchObject({ iso6393: 'lez', name: 'Lezghian' });
    expect(getLanguage('tly')).toMatchObject({ iso6393: 'tly', name: 'Talysh' });
    expect(getLanguage('ce')).toMatchObject({ iso6391: 'ce', iso6393: 'che', name: 'Chechen' });
    expect(getLanguage('isv')).toMatchObject({ iso6393: 'isv', name: 'Interslavic' });
    expect(Date.parse(LOCALE_DATA_SOURCES.ianaLanguageSubtagRegistry)).toBeGreaterThanOrEqual(
      Date.parse('2026-06-14'),
    );

    const azerbaijan = getCountryWithLanguages('AZ');
    const spokenCodes = azerbaijan?.spokenLanguages.map((entry) => entry.code);
    expect(spokenCodes).toEqual(expect.arrayContaining(['az', 'av', 'lez', 'tly']));
    expect(azerbaijan?.spokenLanguages.every((entry) => entry.language)).toBe(true);
  });

  it('supports lookups by alpha-2, alpha-3, numeric and language aliases', () => {
    expect(getCountry('us')?.name.common).toBe('United States');
    expect(getCountry('USA')?.code.alpha2).toBe('US');
    expect(getCountry('840')?.code.alpha2).toBe('US');
    expect(getLanguage('eng')).toBe(getLanguage('en'));
  });
});
