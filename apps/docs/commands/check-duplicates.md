# `translify check-duplicates`

> Formerly `translify duplicate` — the old name still works but is deprecated.

Detects two distinct problems in your translation files:

- **Duplicate values** — multiple keys sharing the same translated string.
- **Duplicate keys** — the same key declared more than once inside a single JSON
  file. `JSON.parse` silently keeps only the last occurrence, so this is
  invisible once the file is loaded — this check scans the raw file text
  instead.

## Usage

```bash
translify check-duplicates
translify check-duplicates --output report.json
```

## Example output

```
⚠ Found 1 duplicate key (silently overwritten by JSON.parse)

▸ Duplicate keys

  messages/en.json
    ✗ CommonMessage.pleaseLogin declared at:
      line 42, column 5
      line 118, column 5

⚠ Found 2 duplicate values

▸ Duplicate values

  [en] "Submit"
    · forms.submit
    · buttons.primary.submit
    · actions.send

  [en] "Cancel"
    · forms.cancel
    · dialog.cancel
```

## When to act

Duplicate values aren't always a problem. Sometimes "Submit" and "Send" really
should be the same string in your language. But duplicates can also indicate:

- Keys that were created twice by different team members
- Opportunities to consolidate into a shared key (e.g. `common.submit`)

Duplicate keys, on the other hand, are always worth fixing — one of the two
values is silently lost.

## Options

| Option            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `--output <file>` | Write the report to a file (`.json` or plain text) |

## Exit code

- `0` — no duplicates found
- `1` — duplicate values or duplicate keys found
