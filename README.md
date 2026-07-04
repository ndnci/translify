<div align="center">
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

- **Extract** all translation keys used in your source code
- **Sync** translation files across languages — add missing keys, remove stale
  ones
- **Detect** unused, missing, and duplicate translation entries
- **Translate** automatically via AI providers (OpenAI GPT-4)
- **Audit** your entire i18n health in one command
- **Optimize** translation files (sort, deduplicate, format)

Built for teams that care about DX and translation quality.

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

Creates a `translify.config.ts` in your project root with full TypeScript
autocompletion.

### Extract translation keys

```bash
translify extract
```

Scans your source files for all `t()`, `i18n.t()`, `translate()` calls and
reports which keys are in use.

### Sync translation files

```bash
translify sync
```

Adds missing keys to all language files, keeping them in sync with your base
language.

### Find unused keys

```bash
translify unused
```

Finds translation keys defined in your JSON files but never referenced in code.

### Run a full audit

```bash
translify audit
```

Runs all checks (missing, unused, duplicates) in one pass — great for CI.

---

## Configuration

Create a `translify.config.ts` at your project root:

```typescript
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
    ignored_words: ['OK', 'API'],
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

---

## Commands

| Command               | Description                                   |
| --------------------- | --------------------------------------------- |
| `translify init`      | Initialize a config file                      |
| `translify extract`   | Extract all translation keys from source code |
| `translify sync`      | Sync translation files across languages       |
| `translify translate` | Auto-translate missing keys via AI            |
| `translify unused`    | Detect unused translation keys                |
| `translify missing`   | Detect missing translation keys               |
| `translify duplicate` | Detect duplicate translation values           |
| `translify optimize`  | Optimize and format translation files         |
| `translify audit`     | Full i18n audit (all checks combined)         |
| `translify doctor`    | Check your Translify setup and environment    |

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

Translify integrates with OpenAI to auto-translate your keys:

```bash
translify translate --locale fr
```

Requires `ai_translation.enabled = true` in your config and a valid
`OPENAI_API_KEY`.

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

---

## Roadmap

- [x] Key extraction from TS/JS/TSX/JSX
- [x] Translation file sync
- [x] Unused / missing / duplicate detection
- [x] AI translation via OpenAI
- [x] Full audit command
- [ ] Vue SFC parser
- [ ] Angular template parser
- [ ] PHP/Laravel support
- [ ] Translation memory / TM integration
- [ ] Web dashboard
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
