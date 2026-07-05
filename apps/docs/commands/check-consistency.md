# `translify check-consistency`

Detect keys that aren't consistently mirrored across every locale — present in
one language but missing from another. Unlike `check-missing` (which compares
source code against translation files), this compares translation files against
each other.

## Usage

```bash
translify check-consistency
translify check-consistency --output report.json
```

## Example output

```
⚠ Found 1 inconsistent key

▸ Locale inconsistencies

  Key                  Present in   Missing in
  ───────────────────  ───────────  ──────────
  home.subtitle        en           fr, de
```

## When this happens

- A key was added to the default language but `add-missing` hasn't been run for
  the other locales yet
- A locale file was hand-edited and a key was accidentally deleted
- A key was added directly to a non-default locale file and never back-filled
  into the default language

## Options

| Option            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `--output <file>` | Write the report to a file (`.json` or plain text) |

## Exit code

- `0` — every key is consistently present across all locales
- `1` — one or more keys are inconsistent

## Tip

Run `translify add-missing` to fill in keys that are missing from a locale
relative to the default language.
