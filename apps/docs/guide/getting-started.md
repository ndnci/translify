# Quick Start

Get Translify running in an existing project in under 5 minutes.

## 1. Install Translify

```bash
npm install -g @ndnci/translify
```

## 2. Initialize a config

Run this in your project root:

```bash
translify init
```

This creates `translify.config.ts` with sensible defaults:

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
  },
});
```

Edit the config to match your project structure.

## 3. Extract translation keys

```bash
translify extract
```

This scans your source files and reports all keys found via your translation
functions.

## 4. Sync translation files

```bash
translify sync
```

Adds any keys used in code but missing from your JSON files. Safe to run
repeatedly.

## 5. Run an audit

```bash
translify audit
```

Full health check: missing keys, unused keys, duplicate values — all in one
command.

## Using in CI

Add to your CI pipeline to catch i18n issues on every PR:

```yaml
- name: i18n audit
  run: npx @ndnci/translify@latest audit
```

The `audit` command exits with code `1` if any issues are found.
