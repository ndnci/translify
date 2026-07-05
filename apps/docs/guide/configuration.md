# Configuration

Translify uses a `translify.config.ts` (or `.js`, `.json`) at your project root.

## Config file locations

Translify searches for config files in this order:

1. `translify.config.ts`
2. `translify.config.js`
3. `translify.config.mjs`
4. `translify.config.cjs`
5. `translify.config.json`
6. `config/translify.config.*`
7. `.config/translify.config.*`

## Using `defineConfig`

The recommended approach — provides full TypeScript autocompletion:

```ts
import { defineConfig } from '@ndnci/translify/config';

export default defineConfig({
  // ...
});
```

## Full config reference

```ts
import { defineConfig } from '@ndnci/translify/config';

export default defineConfig({
  // ── Source ─────────────────────────────────────────────────────────────
  source: {
    // Glob patterns for source files to scan
    include: ['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}'],

    // Files to exclude
    exclude: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**', '**/dist/**'],
  },

  // ── Translations ────────────────────────────────────────────────────────
  translations: {
    // BCP 47 tag of your reference language
    default_language: 'en',

    // Glob patterns pointing to JSON translation files. Recursive globs support
    // both `messages/en.json` and split files like `messages/en/auth.json`.
    files: ['messages/**/*.json'],

    // Used by `translify split` and by missing-key routing in split projects.
    split: {
      // Group by the first dot-key segment by default.
      depth: 1,

      // Strings are shorthand for `{ name: 'tools', match: ['tools'] }`.
      // Object groups can match several substrings or regex patterns.
      groups: [{ name: 'tools', match: ['tool'] }, 'auth'],

      // Supported placeholders: `{language}` and `{group}`.
      output_pattern: 'messages/{language}/{group}.json',
    },
  },

  // ── Extraction ──────────────────────────────────────────────────────────
  extraction: {
    // Function names/expressions to treat as translation calls
    translation_functions: ['t', 'i18n.t', 'translate', '$t'],

    // Namespace-hook functions. A variable bound to one of these calls with a
    // static namespace prefixes every translation call made through it, e.g.
    // `const t = useTranslations("CommonMessage")` then `t("save")` extracts
    // the key `CommonMessage.save` instead of just `save`. Add your own
    // custom wrapper hooks here too (e.g. `useFeatureI18n`) — Translify resolves
    // the hook's own definition (relative imports and tsconfig path aliases)
    // to figure out each returned function's real namespace, even when a
    // single hook returns several functions bound to different namespaces.
    namespace_functions: ['useTranslations', 'getTranslations'],

    // Exact words to never flag as translation keys or hardcoded text
    ignored_words: ['OK', 'API', 'ID'],

    // Regex patterns — strings matching any of these are ignored
    ignored_patterns: ['^v[0-9]+$'],

    // Your own extra patterns
    custom_regex_patterns: [],

    // Include JSDoc comments in reports
    include_comments: false,
  },

  // ── Detection ───────────────────────────────────────────────────────────
  detection: {
    // Ignore files whose content contains any of these
    ignore_files_containing: ['@generated'],

    // Ignore files whose path contains any of these
    ignore_paths_containing: ['__mocks__'],

    // Ignore files whose name matches any of these regex patterns
    ignore_filenames_matching: ['\\.stories\\.'],
  },

  // ── AI Translation ──────────────────────────────────────────────────────
  ai_translation: {
    enabled: false,
    provider: 'openai',
    openai_api_key: process.env.OPENAI_API_KEY,
    model: 'gpt-4.1-mini',
    temperature: 0,
    batch_size: 50,
  },
});
```

## Environment variables

| Variable         | Description                       |
| ---------------- | --------------------------------- |
| `OPENAI_API_KEY` | OpenAI API key for AI translation |

## Validation

All config values are validated with Zod. Errors are reported with clear,
human-readable messages pointing to the exact field that failed. Unknown keys
are rejected too, so typos like `translation.files` instead of
`translations.files` are caught early.

Run validation directly with:

```bash
translify check-config
```

Example error:

```
✗ Invalid Translify configuration

  • ai_translation.openai_api_key: openai_api_key is required when provider
    is "openai" and ai_translation is enabled.
    Set it via process.env.OPENAI_API_KEY or directly in your config.
```
