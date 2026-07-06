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
  },
};
```

Edit the config to match your project structure.

## 3. Run a health audit

```bash
translify audit
```

Full health check in one command: missing keys, unused keys, duplicate values,
duplicate keys, and keys inconsistent across locales. Each check is also
available on its own — `check-missing`, `check-unused`, `check-duplicates`,
`check-consistency` — if you only want one report.

## 4. Add missing keys

```bash
translify add-missing --dry-run
translify add-missing
```

Adds any keys used in code but missing from your JSON files, preserving the
existing formatting of each file. Safe to run repeatedly.

## Using in CI

Add to your CI pipeline to catch i18n issues on every PR:

```yaml
- name: i18n audit
  run: npx @ndnci/translify@latest audit
```

The `audit` command exits with code `1` if any issues are found.
