# `translify duplicate`

Detect translation entries where multiple keys share the same value.

## Usage

```bash
translify duplicate
```

## Example output

```
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

## Exit code

- `0` — no duplicates found
- `1` — duplicates found
