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
  2. Run translify extract to scan your source files
  3. Run translify sync to sync translation files
```

## Generated config

```ts
import { defineConfig } from '@ndnci/translify/config';

export default defineConfig({
  source: {
    include: ['src/**/*.{ts,tsx,js,jsx}'],
    exclude: ['**/*.test.*', '**/node_modules/**'],
  },
  translations: {
    default_language: 'en',
    files: ['messages/*.json'],
  },
  extraction: {
    translation_functions: ['t', 'i18n.t', 'translate'],
    ignored_words: ['OK', 'API', 'ID'],
    ignored_patterns: ['^v[0-9]+$'],
  },
  ai_translation: {
    enabled: false,
    provider: 'openai',
    openai_api_key: process.env.OPENAI_API_KEY,
    model: 'gpt-4.1-mini',
    temperature: 0,
  },
});
```
