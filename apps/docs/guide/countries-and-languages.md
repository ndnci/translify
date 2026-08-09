# Countries and languages

Translify ships a browser-safe locale database with 250 ISO 3166-1 entries and
the complete current language registry, including living, historical, ancient,
extinct, constructed and special entries.

```ts
import {
  COUNTRIES,
  LANGUAGES,
  getCountry,
  getCountryWithLanguages,
  getLanguage,
  formatDateForCountry,
} from '@ndnci/translify/locales';

const france = getCountry('FR');
const english = getLanguage('en'); // aliases such as "eng" work too
const azerbaijan = getCountryWithLanguages('AZ');

formatDateForCountry(new Date(), 'FR', 'long');
```

## Country information

Every country/territory entry includes:

- common, official, native and translated names;
- ISO alpha-2, alpha-3 and numeric codes, plus IOC code when available;
- flag emoji, TLDs, calling codes, currencies and capitals;
- UN/independence status, region, subregion and UN regional group;
- coordinates, area, borders, landlocked status and demonyms;
- population, GDP PPP and literacy estimates when CLDR provides them;
- default locale and short/medium/long/full date examples;
- first day of week, minimum week days and weekend start/end;
- preferred calendars, 12/24-hour cycle, measurement and temperature systems,
  paper size and driving side;
- IANA time zones;
- official, regional, minority and spoken language associations, including
  population/literacy/writing estimates where available.

The language relations cover small and regional languages as well as national
ones. For example, the Azerbaijan entry includes Avaric (`av`/`ava`), Lezghian
(`lez`) and Talysh (`tly`); Chechen is available as `ce`/`che`.

## Normalized language records

Language metadata is stored once in `LANGUAGES`. Country entries reference it by
ISO 639-3 code, so names, scripts and aliases are not duplicated. Use
`getCountryWithLanguages()` when you want the expanded view.

Each language includes its English and native name, ISO 639-1/2B/2T/3 codes when
assigned, BCP 47 code, scope, type, scripts, default territory, writing
direction and associated countries.

## Data provenance

The generated database combines pinned versions of Unicode CLDR, ISO 639-3,
world-countries, locale-tools and countries-and-timezones. Exact versions are
exported as `LOCALE_DATA_SOURCES`; licensing and attribution are documented in
[`THIRD_PARTY_DATA.md`](https://github.com/ndnci/translify/blob/main/THIRD_PARTY_DATA.md).

Population and language-use figures are estimates. CLDR explicitly notes that
very small language populations may be incomplete, so applications should not
treat percentages as census-grade facts.
