# `translify extract`

Extract all translation keys used in your source code.

## Usage

```bash
translify extract
translify extract --verbose
translify extract --config ./config/translify.config.ts
```

## What it does

1. Loads your Translify config
2. Scans all files matching `source.include` patterns
3. Parses each file with the Babel AST parser
4. Finds all calls to configured `translation_functions` (e.g. `t()`,
   `i18n.t()`)
5. Extracts the string literal key from the first argument
6. Reports unique keys found

## Example output

```
✓ Extracted 147 unique keys from 38 files

▸ Extraction summary
  Source files scanned  38
  Total call sites      203
  Unique keys           147
  Scan time             312ms
```

With `--verbose`, all keys are printed:

```
  home.title
  home.description
  nav.home
  nav.about
  ...
```

## Options

| Option         | Description              |
| -------------- | ------------------------ |
| `-c, --config` | Path to config file      |
| `--cwd`        | Working directory        |
| `--verbose`    | Print all extracted keys |

## Supported patterns

| Pattern         | Config entry                        |
| --------------- | ----------------------------------- |
| `t('key')`      | `translation_functions: ['t']`      |
| `i18n.t('key')` | `translation_functions: ['i18n.t']` |
| ``t(`key`)``    | Template literals (no expressions)  |

Dynamic keys (``t(`${variable}`)``) are intentionally skipped — they cannot be
statically analyzed.
