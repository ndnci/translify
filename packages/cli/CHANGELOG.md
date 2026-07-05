# @ndnci/translify

## 0.3.0

### Minor Changes

- Fix `check-unused`/`audit` reporting false positives for keys used inside a
  Next.js App Router `app/` directory: the default `source.include` only covered
  `src/**/*`, so `layout.tsx`/`page.tsx`/`generateMetadata` files under `app/`
  were silently never scanned. `source.include` now defaults to
  `['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}']`, and
  `translify doctor` now warns if an `app/` directory exists but isn't covered
  by an existing config's `source.include`.

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

  `add-missing` (formerly `sync`) now edits translation files surgically via
  `jsonc-parser` instead of re-serializing the whole file, so existing
  indentation, key order, and spacing are preserved — only newly added keys show
  up in the diff.

  Renamed commands for clarity, with the old names kept as deprecated aliases:
  - `sync` → `add-missing`
  - `missing` → `check-missing`
  - `unused` → `check-unused`
  - `duplicate` → `check-duplicates`

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

  `add-missing` (formerly `sync`) now edits translation files surgically via
  `jsonc-parser` instead of re-serializing the whole file, so existing
  indentation, key order, and spacing are preserved — only newly added keys show
  up in the diff.

  Renamed commands for clarity, with the old names kept as deprecated aliases:
  - `sync` → `add-missing`
  - `missing` → `check-missing`
  - `unused` → `check-unused`
  - `duplicate` → `check-duplicates`

  Added `check-consistency` to detect keys that are present in one locale but
  missing from another, and extended `check-duplicates`/`audit` to also catch
  literal duplicate keys within a single raw JSON file (silently dropped by
  `JSON.parse`). Added `--output <file>` to every check command and to `audit`
  to write a JSON or plain-text report for CI. Removed the `extract` command
  (superseded by `audit`); rewrote `init`'s "next steps" to point at `audit` and
  `add-missing` and link to the full command reference.
