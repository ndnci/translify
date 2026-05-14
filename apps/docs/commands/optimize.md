# `translify optimize`

Optimize and format all translation files.

## Usage

```bash
translify optimize
translify optimize --dry-run
translify optimize --no-sort
```

## What it does

- **Sorts keys alphabetically** at every nesting level (enables clean diffs)
- **Reports empty-value entries** (keys present but with empty strings)
- **Formats JSON** with consistent 2-space indentation and a trailing newline

## Example output

```
✓ Optimized 3 files

▸ Optimize results
  en       messages/en.json    187 keys    3 empty
  fr       messages/fr.json    187 keys    0 empty
  de       messages/de.json    187 keys    12 empty ⚠
```

## Options

| Option         | Description                               |
| -------------- | ----------------------------------------- |
| `--no-sort`    | Skip alphabetical key sorting             |
| `--dry-run`    | Preview what would change without writing |
| `-c, --config` | Path to config file                       |

## Tip: run optimize in CI

Adding `translify optimize --dry-run` to CI ensures translation files are always
consistently formatted, catching any manual edits that don't match the expected
format.
