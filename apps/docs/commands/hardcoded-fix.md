# `translify hardcoded-fix`

Replace detected hardcoded text with i18n calls and add default-language
translations.

## Usage

```bash
translify hardcoded-fix --dry-run
translify hardcoded-fix --function t
translify hardcoded-fix --context MarketingPage
translify hardcoded-fix --empty
```

## Behavior

Translify scans the same hardcoded text detected by `check-hardcoded`. For each
replaceable occurrence it:

- reuses an existing default-language translation when the value already exists,
- otherwise generates a key from a context and the text value,
- adds the generated key to every language,
- replaces JSX text and visible string literals with translation calls.

When a file already has a local translator from `useTranslations` or
`getTranslations`, that translator and namespace are reused. Otherwise,
Translify derives a context from the file path and uses the configured
translation function, or `--function` when provided.

## Options

| Option              | Description                                  |
| ------------------- | -------------------------------------------- |
| `--function <name>` | Function to call when no translator is found |
| `--context <name>`  | Force the generated translation context      |
| `--empty`           | Add empty strings for non-default languages  |
| `--dry-run`         | Preview changes without writing files        |
