# `translify add-languages`

Create translation files for one or more new languages.

## Usage

```bash
translify add-languages it de
translify add-languages it de --empty
translify add-languages it --dry-run
```

## Behavior

Translify uses the default language as the source structure.

- For `messages/en.json`, it creates `messages/it.json`.
- For split files such as `messages/en/auth.json`, it creates
  `messages/it/auth.json`.
- Existing target files are skipped.

By default, values are copied from the default language. Use `--empty` to create
the same key structure with empty string values.
