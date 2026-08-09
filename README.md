<div align="center">
  <img src="https://raw.githubusercontent.com/ndnci/translify/main/assets/logo.png" alt="Translify logo" width="120" />

  <h1>⚡ Translify</h1>
  <p><strong>Intelligent i18n CLI — extract, sync, detect, translate.</strong></p>
  <p>Automate your entire internationalization workflow from a single terminal command.</p>

  <a href="https://ndnci.github.io/translify/">
    <img alt="Documentation" src="https://img.shields.io/badge/docs-ndnci.github.io%2Ftranslify-0070f3?style=flat-square" />
  </a>
  <a href="https://www.npmjs.com/package/@ndnci/translify">
    <img alt="npm version" src="https://img.shields.io/npm/v/@ndnci/translify?style=flat-square&color=0070f3" />
  </a>
  <a href="https://www.npmjs.com/package/@ndnci/translify">
    <img alt="npm downloads" src="https://img.shields.io/npm/dm/@ndnci/translify?style=flat-square&color=0070f3" />
  </a>
  <a href="https://github.com/ndnci/translify/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/ndnci/translify?style=flat-square&color=0070f3" />
  </a>
  <a href="https://github.com/ndnci/translify/actions">
    <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/ndnci/translify/ci.yml?style=flat-square&label=CI&color=0070f3" />
  </a>
  <img alt="Node.js" src="https://img.shields.io/node/v/@ndnci/translify?style=flat-square&color=0070f3" />
</div>

---

## What is Translify?

**Translify** is a professional, framework-agnostic CLI that automates the
hardest parts of i18n:

- **Add missing keys** to translation files across languages, preserving
  existing formatting
- **Split large translation files** into context files while still treating each
  language as one catalogue
- **Detect** unused, missing, duplicate, and cross-locale inconsistent
  translation entries, plus hardcoded user-facing text
- **Translate** automatically via AI providers (OpenAI or OpenRouter)
- **Edit and translate visually** in a local browser studio
- **Audit** your entire i18n health in one command
- **Fix** deterministic audit issues with `--dry-run` previews

Built for teams that care about DX and translation quality.

Translify also exports a normalized, browser-safe world locale database with 250
country/territory entries and the complete current language registry:

```ts
import { getCountry, getLanguage } from '@ndnci/translify/locales';

getCountry('FR'); // names, codes, currencies, date/week formats, time zones, languages…
getLanguage('ce'); // Chechen (ISO aliases are supported)
```

---

## Quick Start

```bash
# Install globally
npm install -g @ndnci/translify

# Or run directly without installing
npx translify@latest init
```

### Initialize a config

```bash
translify init
```

Creates a `translify.config.ts` in your project root.

### Run a full audit

```bash
translify audit
```

Runs every check (missing, unused, duplicate values, duplicate keys,
cross-locale inconsistencies, hardcoded text) in one pass — great for CI.

### Add missing keys

```bash
translify add-missing --dry-run
translify add-missing
```

Adds missing keys to all language files, keeping them in sync with your base
language, without touching the existing formatting of each file.

### Find unused keys

```bash
translify check-unused
```

Finds translation keys defined in your JSON files but never referenced in code.

### Split large files

```bash
translify split-translations --dry-run
translify split-translations --groups "tools=tool|foo,auth=auth"
```

Splits files such as `messages/en.json` into context files such as
`messages/en/tools.json`, while audits and fixes continue to treat all files for
one language as a single catalogue.

---

## Configuration

Create a `translify.config.ts` at your project root:

```typescript
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
    split: {
      depth: 1,
      groups: [{ name: 'tools', match: ['tool'] }, 'auth'],
      group_match: 'keys',
      output_pattern: 'messages/{language}/{group}.json',
    },
  },

  extraction: {
    translation_functions: ['t', 'i18n.t', 'translate'],
    namespace_functions: ['useTranslations', 'getTranslations'],
    ignored_words: ['OK', 'API'],
    ignored_patterns: ['^v[0-9]+$'],
  },

  ai_translation: {
    enabled: false,
    provider: 'openai',
    openai_api_key: process.env.OPENAI_API_KEY,
    openrouter_api_key: process.env.OPENROUTER_API_KEY,
    model: 'gpt-4.1-mini',
    temperature: 0,
    batch_size: 50,
    verify: false,
    verify_model: undefined,
    values_only: false,
  },
};
```

---

## Commands

| Command                        | Description                                               |
| ------------------------------ | --------------------------------------------------------- |
| `translify init`               | Initialize a config file                                  |
| `translify config-upgrade`     | Add new config keys without overwriting existing values   |
| `translify audit`              | Full i18n audit (all checks combined)                     |
| `translify check-config`       | Validate config values and unknown keys                   |
| `translify add-missing`        | Add missing keys to translation files across languages    |
| `translify add-languages`      | Create files for one or more new languages                |
| `translify split-translations` | Split large translation files by context                  |
| `translify audit-fix`          | Fix deterministic audit issues                            |
| `translify hardcoded-fix`      | Replace hardcoded text with i18n calls                    |
| `translify translate`          | Auto-translate missing keys via AI                        |
| `translify studio`             | Open the local browser translation studio                 |
| `translify check-missing`      | Detect missing translation keys                           |
| `translify check-unused`       | Detect unused translation keys                            |
| `translify check-duplicates`   | Detect duplicate translation values and duplicate keys    |
| `translify check-consistency`  | Detect keys missing in some locales but present in others |
| `translify check-hardcoded`    | Detect hardcoded user-facing text                         |
| `translify optimize`           | Optimize and format translation files                     |
| `translify version`            | Print the installed version and check for updates         |
| `translify upgrade`            | Update the globally installed CLI to the latest version   |

### Global options

```
-c, --config <path>   Path to config file
    --cwd <path>      Working directory (default: process.cwd())
    --dry-run         Preview changes without writing files
    --verbose         Enable verbose output
-V, --version         Print version
-h, --help            Show help
```

---

## Framework Support

| Framework / Library | Status       |
| ------------------- | ------------ |
| React               | ✅ Supported |
| Next.js             | ✅ Supported |
| TypeScript          | ✅ Supported |
| JavaScript          | ✅ Supported |
| i18next             | ✅ Supported |
| next-intl           | ✅ Supported |
| Vue                 | 🔜 Planned   |
| Angular             | 🔜 Planned   |
| Svelte              | 🔜 Planned   |
| Laravel / PHP       | 🔜 Planned   |

---

## AI Translation

Translify integrates with OpenAI and OpenRouter to auto-translate your keys:

```bash
translify translate --locale fr
```

Requires `ai_translation.enabled = true` in your config and the provider API key
(`OPENAI_API_KEY` or `OPENROUTER_API_KEY`). OpenRouter can use any model slug
from its catalogue, for example `anthropic/claude-sonnet-4` or
`openai/gpt-4.1-mini`.

---

## Packages

This repository is a monorepo. The following packages are published:

| Package                   | Description                        |
| ------------------------- | ---------------------------------- |
| `@ndnci/translify`        | CLI — the main tool                |
| `@ndnci/translify-core`   | Core logic (scanner, parser, etc.) |
| `@ndnci/translify-config` | Config loading and validation      |
| `@ndnci/translify-ai`     | AI translation providers           |
| `@ndnci/translify-shared` | Shared types and utilities         |

The main package also exposes `@ndnci/translify/locales` for country and
language metadata without loading it into the CLI command bundle.

---

## Roadmap

- [x] Key extraction from TS/JS/TSX/JSX
- [x] Translation file sync
- [x] Unused / missing / duplicate detection
- [x] AI translation via OpenAI and OpenRouter
- [x] Full audit command
- [ ] Vue SFC parser
- [ ] Angular template parser
- [ ] PHP/Laravel support
- [ ] Translation memory / TM integration
- [x] Local translation studio
- [ ] VS Code extension

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for
guidelines.

---

## License

MIT License with Trademark Policy — see [LICENSE](./LICENSE) and
[TRADEMARK_POLICY.md](./TRADEMARK_POLICY.md).

The name **Translify** and the `@ndnci/translify` npm scope are trademarks of
their respective owners and may not be used for redistributed or renamed
versions.
