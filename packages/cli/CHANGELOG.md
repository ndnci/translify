# @ndnci/translify

## 0.6.0

### Minor Changes

- Add OpenRouter as an AI translation provider via the official
  `@openrouter/sdk`, including configurable model slugs and OpenRouter API key
  support.
- Add `translify config-upgrade` to apply newly supported config keys to an
  existing config without overwriting existing values.
- Add AI translation options for verification (`verify`, `verify_model`) and
  values-only prompts (`values_only`).
- Report provider usage from `translify translate`, including tokens and
  OpenRouter USD cost when available.
- Improve `translate` for split/multi-file translation projects by matching
  target files to their corresponding default-language source files.
- Add strict config validation, split-file translation support with
  `split-translations`, hardcoded text checks and `hardcoded-fix`, deterministic
  `audit-fix`, language creation, and improved audit reporting.

### Patch Changes

- Read the CLI version from `package.json` at runtime instead of a
  hand-maintained constant, so `translify --version` can't drift out of sync
  with the published package version. Also drop the leftover `defineConfig`
  wrapper from the Next.js demo config in favor of the recommended plain
  `export default { ... }` form.

## 0.5.2

### Patch Changes

- Fix the README logo not rendering on npmjs.com: npm rewrites relative image
  paths against the package's `repository.directory` (`packages/cli`), so
  `assets/logo.png` resolved to a nonexistent path there even though it worked
  on GitHub and in editor previews. The logo now uses an absolute
  `raw.githubusercontent.com` URL that resolves the same way everywhere.

## 0.5.1

### Patch Changes

- Add the Translify logo to the README and documentation site, and fix broken
  logo/favicon references that previously pointed to a nonexistent `logo.svg`.

## 0.5.0

### Minor Changes

- Add strict config validation and a new `check-config` command that catches
  unknown keys, typos, invalid values, and load errors.
- Add split-file translation support. Translation globs now default to recursive
  JSON files, audits merge all files for the same language, and
  `split-translations` can break large locale files into context files with
  custom grouping rules such as `tools=tool|foo`.
- Add `check-hardcoded` and include hardcoded user-facing text in `audit`, with
  config-driven ignored words and regex patterns.
- Add `audit-fix` for deterministic audit fixes: missing keys, unused keys,
  duplicate key declarations, and locale consistency gaps, all with `--dry-run`,
  `--include`, and `--exclude`.
- Add `hardcoded-fix` to replace detected hardcoded text with i18n calls and add
  default-language translations.
- Add `add-languages` to create one or more new languages from the default
  language, preserving single-file or split-file layouts and supporting empty
  values via `--empty`.
- Improve audit output with duplicate-value details and a final issue count.

## 0.4.0

### Minor Changes

- Fix false positives in `check-unused`/`check-missing`/`audit` when a project
  uses a custom wrapper hook that returns multiple translate functions bound to
  different namespaces (e.g. `const { t, tc } = useFeatureI18n("WidgetPanel")`
  where `tc` is internally hardcoded to a shared `"Shared"` namespace).

  Instead of a config-level workaround, extraction now resolves the wrapper
  hook's own definition — following relative imports and `tsconfig.json` path
  aliases — and analyzes its body to determine each returned property's real
  namespace. Add the wrapper's name to `extraction.namespace_functions` (same as
  `useTranslations`/`getTranslations`) and it's handled automatically.

## 0.3.0

### Minor Changes

- Fix `check-unused`/`audit` reporting false positives for keys used inside a
  Next.js App Router `app/` directory: the default `source.include` only covered
  `src/**/*`, so `layout.tsx`/`page.tsx`/`generateMetadata` files under `app/`
  were silently never scanned. `source.include` now defaults to
  `['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}']`.

## 0.2.0

### Minor Changes

- Add a `translify version` command that prints the installed version and checks
  the npm registry for a newer release on the same channel, pointing you at
  `translify upgrade` when one is available.
- 4b5380e: Fix a Node `punycode` deprecation warning printed on every run by
  bumping the `openai` dependency past the `node-fetch`/`whatwg-url`/`tr46`
  chain that triggered it.

  Add namespace-aware extraction: `const t = useTranslations("Namespace")` (or
  `getTranslations({ namespace: "..." })`) now correctly prefixes keys extracted
  through `t(...)` with `Namespace.`, instead of adding a duplicate bare key on
  sync. Configurable via the new `extraction.namespace_functions` config option.

  `add-missing` now edits translation files surgically via `jsonc-parser`
  instead of re-serializing the whole file, so existing indentation, key order,
  and spacing are preserved — only newly added keys show up in the diff.

  Added `check-consistency` to detect keys that are present in one locale but
  missing from another, and extended `check-duplicates`/`audit` to also catch
  literal duplicate keys within a single raw JSON file (silently dropped by
  `JSON.parse`). Added `--output <file>` to every check command and to `audit`
  to write a JSON or plain-text report for CI. Removed the `extract` command
  (superseded by `audit`); rewrote `init`'s "next steps" to point at `audit` and
  `add-missing` and link to the full command reference.

## 0.1.0

### Minor Changes

- Fix a Node `punycode` deprecation warning printed on every run by bumping the
  `openai` dependency past the `node-fetch`/`whatwg-url`/`tr46` chain that
  triggered it.

  Add namespace-aware extraction: `const t = useTranslations("Namespace")` (or
  `getTranslations({ namespace: "..." })`) now correctly prefixes keys extracted
  through `t(...)` with `Namespace.`, instead of adding a duplicate bare key on
  sync. Configurable via the new `extraction.namespace_functions` config option.

  `add-missing` now edits translation files surgically via `jsonc-parser`
  instead of re-serializing the whole file, so existing indentation, key order,
  and spacing are preserved — only newly added keys show up in the diff.

  Added `check-consistency` to detect keys that are present in one locale but
  missing from another, and extended `check-duplicates`/`audit` to also catch
  literal duplicate keys within a single raw JSON file (silently dropped by
  `JSON.parse`). Added `--output <file>` to every check command and to `audit`
  to write a JSON or plain-text report for CI. Removed the `extract` command
  (superseded by `audit`); rewrote `init`'s "next steps" to point at `audit` and
  `add-missing` and link to the full command reference.
