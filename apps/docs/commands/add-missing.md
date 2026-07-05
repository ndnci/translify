# `translify add-missing`

> Formerly `translify sync` — the old name still works but is deprecated.

Add keys used in code but missing from your JSON translation files.

## Usage

```bash
translify add-missing
translify add-missing --dry-run
translify add-missing --empty
```

## What it does

1. Extracts all translation keys from source code (namespace-aware — see
   [`namespace_functions`](/guide/configuration) for `useTranslations`/
   `getTranslations` support)
2. Loads all translation files matching `translations.files`
3. For each language file, adds keys that are missing
4. By default, copies the value from the default language for non-default
   locales
5. Writes updated files to disk **surgically** — only the newly inserted keys
   show up in the diff. Existing indentation, key order, and spacing are left
   untouched (no more full-file reformats on large files)

## Example output

```
✓ Added 12 keys across 3 files

▸ Results
  en       messages/en.json    +8 added
  fr       messages/fr.json    +12 added
  de       messages/de.json    up to date
```

## Options

| Option         | Description                                           |
| -------------- | ----------------------------------------------------- |
| `--empty`      | Add missing keys with empty values instead of copying |
| `--dry-run`    | Preview what would change without writing             |
| `-c, --config` | Path to config file                                   |

## Safe to run repeatedly

`add-missing` only ever adds keys — it never removes them. You can run it any
time without fear of losing existing translations. Use `translify check-unused`
to review keys that may be safe to remove.
