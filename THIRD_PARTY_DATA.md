# Third-party data notices

The Translify source code is MIT licensed. The generated locale database in
`packages/cli/src/locales/data.json` combines the following data sources:

- Unicode CLDR 48.2.0 —
  [Unicode License v3](https://www.unicode.org/license.txt)
- `iso-639-3` 3.0.1 — MIT; derived from the ISO 639-3 registry
- `world-countries` 5.1.0 —
  [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)
- `@locale-tools/countries` 0.2.5 — MIT
- `countries-and-timezones` 3.10.0 — MIT
- IANA Language Subtag Registry — public protocol registry, with its file date
  exported in `LOCALE_DATA_SOURCES`

The generated locale database is made available under ODbL 1.0. This does not
change the MIT license of Translify's software source code.

Run `pnpm generate:locales` to rebuild the database from the pinned package
versions and the then-current IANA registry (network access is required).
Country/language population values are estimates; Unicode CLDR notes that small
language populations may be incomplete.
