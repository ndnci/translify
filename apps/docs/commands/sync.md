# `translify sync`

Sync translation files — add keys used in code but missing from JSON files.

## Usage

```bash
translify sync
translify sync --dry-run
translify sync --empty
```

## What it does

1. Extracts all translation keys from source code
2. Loads all translation files matching `translations.files`
3. For each language file, adds keys that are missing
4. By default, copies the value from the default language for non-default
   locales
5. Writes updated files to disk

## Example output

```
✓ Synced 3 language files (12 keys added)

▸ Sync results
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

`sync` only ever adds keys — it never removes them. You can run it any time
without fear of losing existing translations. Use `translify unused` to review
keys that may be safe to remove.
