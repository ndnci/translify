# Architecture — Translify

## Overview

Translify is structured as a **Turborepo monorepo** with 5 published packages
and 2 application workspaces. The design is intentionally layered: each package
has a single responsibility, and the CLI is just a thin command layer on top.

```
┌──────────────────────────────────────────────────────────┐
│                     @ndnci/translify                     │
│                    (packages/cli)                        │
│  Commander.js · Chalk · Ora · 10 commands                │
└──────────┬──────────┬──────────┬──────────────────────────┘
           │          │          │
           ▼          ▼          ▼
┌──────────────┐ ┌───────────┐ ┌───────────────────┐
│ translify-   │ │translify- │ │  translify-config  │
│    core      │ │    ai     │ │  (packages/config) │
│              │ │           │ │                    │
│ Scanner      │ │ OpenAI    │ │ Zod schema         │
│ Parser       │ │ Provider  │ │ Config loader      │
│ Extractor    │ │ Translator│ │ defineConfig()     │
│ Sync         │ └─────┬─────┘ └──────────┬─────────┘
│ Detection    │       │                  │
│ Optimizer    │       │                  │
└──────┬───────┘       │                  │
       │               │                  │
       └───────────────┴──────────────────┘
                       │
                       ▼
           ┌──────────────────────┐
           │  translify-shared    │
           │  (packages/shared)   │
           │                      │
           │  Types               │
           │  Errors              │
           │  Constants           │
           │  Utilities           │
           └──────────────────────┘
```

---

## Package responsibilities

### `@ndnci/translify-shared`

The **foundation layer**. Contains:

- **Types** — all TypeScript interfaces shared across packages
  (`ExtractionEntry`, `TranslationFile`, `UnusedKeyResult`, etc.)
- **Errors** — typed error classes with DX-friendly messages (`ConfigError`,
  `ParseError`, `AIProviderError`, etc.)
- **Constants** — default config values, supported extensions, etc.
- **Utils** — pure functions (`flattenTranslations`, `unflattenTranslations`,
  `sortTranslationKeys`, `matchesAnyPattern`, etc.)

**Never imports from other Translify packages.**

### `@ndnci/translify-config`

The **configuration layer**. Handles:

- **Zod schema** — exhaustive validation with defaults and cross-field checks
- **Config loader** — finds config files in the filesystem, loads them using
  `jiti` (TS/JS) or JSON.parse (JSON)
- **Config resolver** — composes loading + validation into a single
  `resolveConfig()` call used by all commands
- **`defineConfig()`** — type-safe helper for user config files

### `@ndnci/translify-core`

The **engine**. Contains all the i18n business logic:

| Module      | Responsibility                                      |
| ----------- | --------------------------------------------------- |
| `scanner`   | Glob-based file discovery via `fast-glob`           |
| `parser`    | Babel AST parsing for TS/TSX/JS/JSX                 |
| `extractor` | AST traversal to find `t()` call sites              |
| `sync`      | Read/write translation JSON files, add missing keys |
| `detection` | Unused, missing, and duplicate key detection        |
| `optimizer` | Sort keys, report empty values                      |

**No I/O side effects except in `sync` (writes JSON files) and `optimizer`.**
All other modules are pure transforms.

### `@ndnci/translify-ai`

The **AI translation layer**:

- **`BaseTranslationProvider`** — abstract contract all providers implement
- **`OpenAIProvider`** — OpenAI SDK integration with JSON mode, retry-safe,
  preserves interpolation variables
- **`translateMissingKeys()`** — batching orchestrator

To add a new provider: extend `BaseTranslationProvider` and register it in
`createProvider()`. See
[HOW_TO_ADD_AI_PROVIDER.md](./HOW_TO_ADD_AI_PROVIDER.md).

### `@ndnci/translify` (CLI)

The **user-facing layer**. Thin wrappers over core logic:

- **Commander.js** for command parsing and help text
- **Chalk** for colored output
- **Ora** for progress spinners
- **Logger** — structured output (debug/info/warn/error/success)
- **Commands** — each command is a self-contained module in `src/commands/`

---

## Data flow

### `translify add-missing` (formerly `sync`)

```
Config → [file scanner + translation scanner] → extractor → syncTranslationFiles()
       → writeTranslationFileSurgical() (jsonc-parser edits, preserves formatting)
```

### `translify audit` (alias `check-all`)

```
Config → [source files + translation files]
       → [extractor + loadTranslationFile()]
       → [detectUnusedKeys + detectMissingKeys + detectDuplicateValues
          + detectDuplicateKeys + detectLocaleInconsistencies]
       → AuditResult → CLI output
```

Each detector above is also exposed as its own command (`check-missing`,
`check-unused`, `check-duplicates`, `check-consistency`) for a narrower report.

---

## Key design decisions

### Why Babel for parsing?

Babel's parser is the most battle-tested JS/TS parser available. It handles
every modern syntax (decorators, optional chaining, TSX, etc.) and has
`errorRecovery: true` — so a single syntax error in one file doesn't abort the
entire scan.

Alternative considered: `ts-morph` / TypeScript compiler API. Rejected because
it's slower, heavier, and requires a `tsconfig.json` to be present.

### Why `jiti` for config loading?

Config files are TypeScript (`.ts`). Loading them at runtime requires either
transpilation or a register hook. `jiti` is the smallest, fastest option that
handles TS, ESM, CJS, and JSON in a unified API. Used by Vite, Nuxt, and others.

Alternative: `tsx/esm` register hook — rejected because it affects the entire
process rather than loading a single file.

### Why ESM for the CLI output?

The CLI depends on `chalk@5` and `ora@8`, which are ESM-only. Outputting ESM
avoids dynamic import() wrappers and keeps the code clean. Node.js 22 has full
ESM support, so there's no downside.

### Why `noExternal` in tsup?

All workspace packages are bundled into each published package's output. This
means users only need to install the package they want — no hidden
peer-dependency tree from internal packages.

---

## Adding a new framework parser

See [HOW_TO_ADD_PARSER.md](./HOW_TO_ADD_PARSER.md).

## Adding a new AI provider

See [HOW_TO_ADD_AI_PROVIDER.md](./HOW_TO_ADD_AI_PROVIDER.md).

## Release process

See [HOW_TO_RELEASE.md](./HOW_TO_RELEASE.md).
