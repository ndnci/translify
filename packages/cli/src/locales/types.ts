export type LanguageType =
  | 'living'
  | 'historical'
  | 'extinct'
  | 'ancient'
  | 'constructed'
  | 'special'
  | 'unknown';

export type LanguageScope = 'individual' | 'macrolanguage' | 'special';
export type TextDirection = 'ltr' | 'rtl';
export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DateStyle = 'short' | 'medium' | 'long' | 'full';

export interface LanguageInfo {
  name: string;
  nativeName: string;
  type: LanguageType;
  scope: LanguageScope;
  iso6393: string;
  iso6392B?: string;
  iso6392T?: string;
  iso6391?: string;
  bcp47: string;
  scripts: string[];
  defaultScript?: string;
  defaultRegion?: string;
  direction: TextDirection;
  /** ISO 3166-1 alpha-2 territories in which the language is used. */
  territories: string[];
}

export interface CountryLanguage {
  /** Preferred BCP 47/ISO code (ISO 639-1 when one exists, otherwise ISO 639-3). */
  code: string;
  iso6393: string;
  official: boolean;
  /** Official at national/de-facto level (as opposed to regional/minority status). */
  nationalOfficial?: boolean;
  officialStatus?: 'de_facto_official' | 'official' | 'official_regional' | 'official_minority';
  populationPercent?: number;
  literacyPercent?: number;
  writingPercent?: number;
  scripts: string[];
}

export interface DateFormatInfo {
  /** Stable example rendered for 23 November 2001 in UTC. */
  example: string;
  order: Array<'day' | 'month' | 'year'>;
  options: { dateStyle: DateStyle };
  /** Locale-tools/CLDR-style short pattern when available. */
  pattern?: string;
}

export interface CountryInfo {
  name: {
    common: string;
    official: string;
    native: Record<string, { common: string; official: string }>;
  };
  code: { alpha2: string; alpha3: string; numeric: string; olympic?: string };
  tld: string[];
  independent: boolean;
  status: string;
  unMember: boolean;
  unRegionalGroup?: string;
  currencies: Record<string, { name: string; symbol: string }>;
  callingCodes: string[];
  capital: string[];
  altSpellings: string[];
  region: string;
  subregion: string;
  translations: Record<string, { common: string; official: string }>;
  coordinates: { latitude: number; longitude: number };
  landlocked: boolean;
  borders: string[];
  areaKm2: number;
  flag: string;
  demonyms: Record<string, { f: string; m: string }>;
  population?: number;
  gdpPpp?: number;
  literacyPercent?: number;
  defaultLocale: string;
  dateFormats: Record<DateStyle, DateFormatInfo>;
  week: {
    firstDay: WeekDay;
    minDays: number;
    weekend: { start: WeekDay; end: WeekDay };
  };
  calendars: string[];
  measurementSystem: 'metric' | 'US' | 'UK';
  temperatureSystem: 'celsius' | 'fahrenheit';
  distanceSystem: 'kilometer' | 'mile';
  paperSize: 'A4' | 'US-Letter';
  hourCycle: '12h' | '24h';
  drivingSide: 'left' | 'right';
  timeZones: string[];
  languages: CountryLanguage[];
}

export interface CountryLanguageDetails extends CountryLanguage {
  language: LanguageInfo;
}

export interface CountryWithLanguages extends CountryInfo {
  spokenLanguages: CountryLanguageDetails[];
}

export interface LocaleDataSources {
  cldr: string;
  iso6393: string;
  worldCountries: string;
  localeToolsCountries: string;
  countriesAndTimezones: string;
  /** File-Date from the live IANA Language Subtag Registry used at generation time. */
  ianaLanguageSubtagRegistry: string;
}

export interface LocaleData {
  sources: LocaleDataSources;
  languages: LanguageInfo[];
  countries: CountryInfo[];
}
