import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import localeToolsPackage from '@locale-tools/countries';
import languageNames from 'all-iso-language-codes';
import { getTimezonesForCountry } from 'countries-and-timezones';
import { iso6393 } from 'iso-639-3';
import worldCountries from 'world-countries';

const root = resolve(import.meta.dirname, '..');
const outputPath = resolve(root, 'packages/cli/src/locales/data.json');
const referenceDate = new Date('2001-11-23T12:00:00Z');
const DATE_PARTS = new Set(['day', 'month', 'year']);
const RTL_SCRIPTS = new Set([
  'Adlm',
  'Arab',
  'Hebr',
  'Mand',
  'Nkoo',
  'Rohg',
  'Samr',
  'Syrc',
  'Thaa',
]);

function cldr(name) {
  const path = resolve(root, `node_modules/cldr-core/supplemental/${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')).supplemental[name];
}

const territoryInfo = cldr('territoryInfo');
const weekData = cldr('weekData');
const calendarPreferenceData = cldr('calendarPreferenceData');
const measurementData = cldr('measurementData');
const timeData = cldr('timeData');
const likelySubtags = cldr('likelySubtags');
const languageData = cldr('languageData');
const localeCountries = unwrapDefault(localeToolsPackage.countries);
const ianaRegistry = await loadIanaLanguageRegistry();
const deprecatedLanguageCodes = new Set(
  ianaRegistry.records
    .filter((record) => record.Type === 'language' && record.Deprecated)
    .map((record) => record.Subtag),
);
const languageSources = iso6393.filter(
  (language) => !deprecatedLanguageCodes.has(language.iso6393),
);
const knownLanguageCodes = new Set(
  languageSources.flatMap((language) =>
    [language.iso6391, language.iso6392B, language.iso6392T, language.iso6393].filter(Boolean),
  ),
);

for (const record of ianaRegistry.records) {
  if (
    record.Type !== 'language' ||
    record.Deprecated ||
    record.Subtag.length !== 3 ||
    record.Scope === 'collection' ||
    knownLanguageCodes.has(record.Subtag)
  ) {
    continue;
  }
  languageSources.push({
    name: record.Description[0] ?? record.Subtag,
    type: 'unknown',
    scope: record.Scope === 'macrolanguage' ? 'macrolanguage' : 'individual',
    iso6393: record.Subtag,
  });
  knownLanguageCodes.add(record.Subtag);
}

const languageAliases = new Map();
const languages = languageSources.map((source) => {
  const codes = [source.iso6393, source.iso6392B, source.iso6392T, source.iso6391].filter(Boolean);
  const likely = codes.map((code) => likelySubtags[code]).find(Boolean);
  const likelyParts = likely?.split('-') ?? [];
  const cldrLanguage = languageData[source.iso6391 ?? source.iso6393] ?? {};
  const scripts = unique([
    ...asList(cldrLanguage._scripts),
    ...(likelyParts[1] ? [likelyParts[1]] : []),
  ]);
  const regions = new Set(asList(cldrLanguage._territories));
  const nativeName = codes.map((code) => safeNativeName(code)).find(Boolean);
  const language = {
    name: source.name,
    nativeName: nativeName ?? source.name,
    type: source.type,
    scope: source.scope,
    iso6393: source.iso6393,
    ...(source.iso6392B && { iso6392B: source.iso6392B }),
    ...(source.iso6392T && { iso6392T: source.iso6392T }),
    ...(source.iso6391 && { iso6391: source.iso6391 }),
    bcp47: source.iso6391 ?? source.iso6393,
    scripts,
    ...(likelyParts[1] && { defaultScript: likelyParts[1] }),
    ...(likelyParts[2] && { defaultRegion: likelyParts[2] }),
    direction: scripts.some((script) => RTL_SCRIPTS.has(script)) ? 'rtl' : 'ltr',
    territories: regions,
  };
  for (const code of codes) languageAliases.set(code.toLowerCase(), language);
  return language;
});

const countries = worldCountries.map((source) => {
  const territory = territoryInfo[source.cca2] ?? {};
  const localeCountry = localeCountries.find((country) => country.cca2 === source.cca2);
  const languageMap = new Map();

  for (const code of localeCountry?.languages?.official ?? []) {
    addCountryLanguage(languageMap, code, { official: true });
  }
  for (const code of localeCountry?.languages?.spoken ?? []) {
    addCountryLanguage(languageMap, code, {});
  }
  for (const code of Object.keys(source.languages ?? {})) {
    addCountryLanguage(languageMap, code, { official: true, nationalOfficial: true });
  }
  for (const [code, population] of Object.entries(territory.languagePopulation ?? {})) {
    addCountryLanguage(languageMap, code, {
      populationPercent: optionalNumber(population._populationPercent),
      literacyPercent: optionalNumber(population._literacyPercent),
      writingPercent: optionalNumber(population._writingPercent),
      officialStatus: population._officialStatus,
      official: Boolean(population._officialStatus),
      nationalOfficial: ['official', 'de_facto_official'].includes(population._officialStatus),
      script: code.includes('_') ? code.split('_')[1] : undefined,
    });
  }

  for (const association of languageMap.values()) {
    const language = languageAliases.get(association.iso6393);
    language?.territories.add(source.cca2);
  }

  const defaultLocale = resolveDefaultLocale(source.cca2, languageMap, localeCountry?.locale?.ietf);
  const dateFormats = buildDateFormats(defaultLocale, localeCountry?.locale?.dateFormats);
  const callingCodes = source.callingCodes?.length
    ? source.callingCodes
    : (source.idd?.suffixes ?? []).map((suffix) => `${source.idd.root ?? ''}${suffix}`);
  const timeZones = unique([
    ...(localeCountry?.locale?.timezones ?? []),
    ...(getTimezonesForCountry(source.cca2) ?? []).map((timeZone) => timeZone.name),
  ]);

  return {
    name: source.name,
    code: {
      alpha2: source.cca2,
      alpha3: source.cca3,
      numeric: source.ccn3,
      ...(source.cioc && { olympic: source.cioc }),
    },
    tld: source.tld ?? [],
    independent: source.independent ?? false,
    status: source.status,
    unMember: source.unMember,
    ...(source.unRegionalGroup && { unRegionalGroup: source.unRegionalGroup }),
    currencies: source.currencies ?? {},
    callingCodes,
    capital: source.capital ?? [],
    altSpellings: source.altSpellings ?? [],
    region: source.region,
    subregion: source.subregion,
    translations: source.translations ?? {},
    coordinates: { latitude: source.latlng[0], longitude: source.latlng[1] },
    landlocked: source.landlocked,
    borders: source.borders ?? [],
    areaKm2: source.area,
    flag: source.flag,
    demonyms: source.demonyms ?? {},
    population: optionalNumber(territory._population),
    gdpPpp: optionalNumber(territory._gdp),
    literacyPercent: optionalNumber(territory._literacyPercent),
    defaultLocale,
    dateFormats,
    week: {
      firstDay: territoryValue(weekData.firstDay, source.cca2),
      minDays: Number(territoryValue(weekData.minDays, source.cca2)),
      weekend: {
        start: territoryValue(weekData.weekendStart, source.cca2),
        end: territoryValue(weekData.weekendEnd, source.cca2),
      },
    },
    calendars: calendarPreferenceData[source.cca2] ?? calendarPreferenceData['001'],
    measurementSystem:
      measurementData.measurementSystem[source.cca2] ?? measurementData.measurementSystem['001'],
    temperatureSystem:
      localeCountry?.locale?.temperatureMeasurement ??
      (measurementData['measurementSystem-category-temperature'][source.cca2] === 'US'
        ? 'fahrenheit'
        : 'celsius'),
    distanceSystem: localeCountry?.locale?.distanceMeasurement ?? 'kilometer',
    paperSize: measurementData.paperSize[source.cca2] ?? measurementData.paperSize['001'],
    hourCycle: resolveHourCycle(source.cca2, localeCountry?.locale?.hourClock),
    drivingSide: localeCountry?.locale?.drivingSide ?? 'right',
    timeZones,
    languages: [...languageMap.values()].sort((a, b) => {
      if (a.official !== b.official) return a.official ? -1 : 1;
      return (
        (b.populationPercent ?? 0) - (a.populationPercent ?? 0) || a.code.localeCompare(b.code)
      );
    }),
  };
});

for (const language of languages) {
  language.territories = [...language.territories].sort();
}

const data = {
  sources: {
    cldr: '48.2.0',
    iso6393: '3.0.1',
    worldCountries: '5.1.0',
    localeToolsCountries: '0.2.5',
    countriesAndTimezones: '3.10.0',
    ianaLanguageSubtagRegistry: ianaRegistry.date,
  },
  languages,
  countries: countries.sort((a, b) => a.code.alpha2.localeCompare(b.code.alpha2)),
};

writeFileSync(outputPath, `${JSON.stringify(data)}\n`, 'utf8');
process.stdout.write(
  `Generated ${data.countries.length} countries and ${data.languages.length} languages in ${outputPath}\n`,
);

function addCountryLanguage(map, rawCode, details) {
  const normalizedCode = String(rawCode).replace(/_/g, '-');
  const baseCode = normalizedCode.split('-')[0].toLowerCase();
  const language = languageAliases.get(baseCode);
  if (!language) return;
  const existing = map.get(language.iso6393) ?? {
    code: language.iso6391 ?? language.iso6393,
    iso6393: language.iso6393,
    official: false,
    scripts: [],
  };
  existing.official ||= details.official ?? false;
  if (details.nationalOfficial) existing.nationalOfficial = true;
  if (details.officialStatus) existing.officialStatus = details.officialStatus;
  existing.populationPercent = maxOptional(existing.populationPercent, details.populationPercent);
  existing.literacyPercent = maxOptional(existing.literacyPercent, details.literacyPercent);
  existing.writingPercent = maxOptional(existing.writingPercent, details.writingPercent);
  existing.scripts = unique([...existing.scripts, ...(details.script ? [details.script] : [])]);
  map.set(language.iso6393, existing);
}

function resolveDefaultLocale(countryCode, associations, localeOptions = []) {
  const ranked = [...associations.values()].sort((a, b) => {
    if (a.nationalOfficial !== b.nationalOfficial) return a.nationalOfficial ? -1 : 1;
    if (a.official !== b.official) return a.official ? -1 : 1;
    return (b.populationPercent ?? 0) - (a.populationPercent ?? 0);
  });
  const primary = ranked[0];
  const matchingLocales = localeOptions.filter(
    (locale) =>
      locale.toLowerCase().startsWith(`${primary?.code.toLowerCase()}-`) &&
      locale.toUpperCase().endsWith(`-${countryCode}`),
  );
  const defaultScript = languageAliases.get(primary?.iso6393)?.defaultScript;
  const explicit =
    matchingLocales.find((locale) => defaultScript && locale.includes(`-${defaultScript}-`)) ??
    matchingLocales[0];
  if (explicit) return explicit;
  return `${primary?.code ?? 'en'}-${countryCode}`;
}

function buildDateFormats(locale, sourcePatterns = {}) {
  const styles = {};
  for (const style of ['short', 'medium', 'long', 'full']) {
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: 'UTC' });
    const parts = formatter.formatToParts(referenceDate);
    styles[style] = {
      example: formatter.format(referenceDate),
      order: parts.filter((part) => DATE_PARTS.has(part.type)).map((part) => part.type),
      options: { dateStyle: style },
      ...(style === 'short' && sourcePatterns[locale] && { pattern: sourcePatterns[locale] }),
    };
  }
  return styles;
}

function resolveHourCycle(countryCode, fallback) {
  const preferred = (timeData[countryCode] ?? timeData['001'])?._preferred;
  if (preferred?.startsWith('H') || preferred?.startsWith('k')) return '24h';
  if (preferred?.startsWith('h') || preferred?.startsWith('K')) return '12h';
  return fallback ?? '24h';
}

function territoryValue(values, countryCode) {
  return values[countryCode] ?? values['001'];
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function maxOptional(first, second) {
  if (first === undefined) return second;
  if (second === undefined) return first;
  return Math.max(first, second);
}

function safeNativeName(code) {
  try {
    return languageNames.getNativeName(code) || undefined;
  } catch {
    return undefined;
  }
}

function unwrapDefault(value) {
  let current = value;
  while (current?.default) current = current.default;
  return current;
}

function asList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : String(value).split(' ');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function loadIanaLanguageRegistry() {
  const url = 'https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry';
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download IANA language registry: ${response.status}`);
  }
  const text = await response.text();
  const date = text.match(/^File-Date:\s*(\S+)/m)?.[1];
  if (!date) throw new Error('IANA language registry has no File-Date');

  const records = text
    .split('%%')
    .slice(1)
    .map((block) => {
      const record = { Description: [] };
      let previousKey;
      for (const line of block.trim().split(/\r?\n/)) {
        if (/^\s/.test(line) && previousKey) {
          const target = record[previousKey];
          if (Array.isArray(target)) target[target.length - 1] += ` ${line.trim()}`;
          else record[previousKey] = `${target} ${line.trim()}`;
          continue;
        }
        const separator = line.indexOf(':');
        if (separator < 0) continue;
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1).trim();
        previousKey = key;
        if (key === 'Description') record.Description.push(value);
        else record[key] = value;
      }
      return record;
    });
  return { date, records };
}
