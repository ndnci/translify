# `translify init`

Initialize a Translify config file in your project.

## Usage

```bash
translify init
translify init --force
```

## What it creates

- `translify.config.ts` — config file with sensible defaults
- `messages/en.json` — empty translation file (if no `messages/` directory
  exists)

## Options

| Option    | Description                                  |
| --------- | -------------------------------------------- |
| `--force` | Overwrite an existing config file            |
| `--cwd`   | Working directory (default: `process.cwd()`) |

## Example

```bash
$ translify init

✓ Created translify.config.ts
✓ Created messages/en.json

  Next steps:

  1. Edit translify.config.ts to match your project
  2. Run translify audit for a full health report (missing, unused, duplicate, and inconsistent keys)
  3. Run translify add-missing --dry-run to preview new keys, then translify add-missing to write them

  Full command reference: https://ndnci.github.io/translify/commands/
```

## Generated config

```ts
// Optional editor autocomplete:
// /** @type {import('@ndnci/translify/config').TranslifyConfig} */
export default {
  source: {
    include: ['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}'],
    exclude: ['**/*.test.*', '**/node_modules/**'],
  },
  translations: {
    default_language: 'en',
    files: ['messages/**/*.json'],
  },
  extraction: {
    translation_functions: ['t', 'i18n.t', 'translate'],
    namespace_functions: ['useTranslations', 'getTranslations'],
    ignored_words: ['OK', 'API', 'ID'],
    ignored_patterns: ['^v[0-9]+$'],
  },
  ai_translation: {
    enabled: false,
    provider: 'openai',
    openai_api_key: process.env.OPENAI_API_KEY,
    openrouter_api_key: process.env.OPENROUTER_API_KEY,
    model: 'gpt-5.6-luna',
    temperature: 0,
    batch_size: 50,
    verify: false,
    verify_model: undefined,
    values_only: false,
  },
};
```

This generated default targets OpenAI. If you select OpenRouter, Translify
recommends `deepseek/deepseek-v4-flash`; see the [model guide](../guide/models).
