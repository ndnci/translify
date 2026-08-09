import rawLocaleData from './data.json';
import type {
  CountryInfo,
  CountryWithLanguages,
  DateStyle,
  LanguageInfo,
  LocaleData,
} from './types.js';

export type * from './types.js';

const localeData = rawLocaleData as unknown as LocaleData;

export const LOCALE_DATA_SOURCES = Object.freeze(localeData.sources);
export const LANGUAGES: readonly LanguageInfo[] = Object.freeze(localeData.languages);
export const COUNTRIES: readonly CountryInfo[] = Object.freeze(localeData.countries);

const languageByCode = new Map<string, LanguageInfo>();
for (const language of LANGUAGES) {
  for (const code of [
    language.iso6391,
    language.iso6392B,
    language.iso6392T,
    language.iso6393,
    language.bcp47,
  ]) {
    if (code) languageByCode.set(normalize(code), language);
  }
}

const countryByCode = new Map<string, CountryInfo>();
for (const country of COUNTRIES) {
  countryByCode.set(normalize(country.code.alpha2), country);
  countryByCode.set(normalize(country.code.alpha3), country);
  countryByCode.set(normalize(country.code.numeric), country);
  if (country.code.olympic) countryByCode.set(normalize(country.code.olympic), country);
}

export function getLanguage(code: string): LanguageInfo | undefined {
  return languageByCode.get(normalize(code).split('-')[0] ?? '');
}

export function getCountry(code: string): CountryInfo | undefined {
  return countryByCode.get(normalize(code));
}

export function getCountryWithLanguages(code: string): CountryWithLanguages | undefined {
  const country = getCountry(code);
  if (!country) return undefined;

  return {
    ...country,
    spokenLanguages: country.languages.flatMap((association) => {
      const language = getLanguage(association.iso6393);
      return language ? [{ ...association, language }] : [];
    }),
  };
}

export function getCountriesForLanguage(code: string): CountryInfo[] {
  const language = getLanguage(code);
  if (!language) return [];
  return language.territories.flatMap((countryCode) => {
    const country = getCountry(countryCode);
    return country ? [country] : [];
  });
}

export function formatDateForCountry(
  date: Date | number | string,
  countryCode: string,
  style: DateStyle = 'short',
): string {
  const country = getCountry(countryCode);
  if (!country) throw new Error(`Unknown country code: ${countryCode}`);
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) throw new Error('Invalid date');

  return new Intl.DateTimeFormat(country.defaultLocale, {
    dateStyle: style,
    timeZone: 'UTC',
  }).format(value);
}

function normalize(code: string): string {
  return code.trim().replace(/_/g, '-').toLowerCase();
}
