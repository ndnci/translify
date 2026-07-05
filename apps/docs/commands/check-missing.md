# `translify check-missing`

> Formerly `translify missing` — the old name still works but is deprecated.

Detect translation keys that are used in source code but missing from one or
more translation files.

## Usage

```bash
translify check-missing
translify check-missing --output report.json
```

## Example output

```
⚠ Found 3 missing keys

▸ Missing keys

  [fr] messages/fr.json
    ✗ home.hero.subtitle    src/app/page.tsx:14
    ✗ profile.edit.title    src/app/profile/page.tsx:8

  [de] messages/de.json
    ✗ home.hero.subtitle    src/app/page.tsx:14
```

## Options

| Option            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `--output <file>` | Write the report to a file (`.json` or plain text) |

## Exit code

- `0` — no missing keys
- `1` — missing keys found

## Tip

Run `translify add-missing` after `translify check-missing` to automatically add
the missing keys with empty values (or copied from your default language).
