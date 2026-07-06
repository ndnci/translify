# Architecture

Translify is a Turborepo monorepo with one published CLI package and several
internal packages. The CLI layer stays thin; the real work lives in focused
packages that can be tested independently.

## Packages

| Package                   | Responsibility                                  |
| ------------------------- | ----------------------------------------------- |
| `@ndnci/translify`        | CLI commands, output, and command orchestration |
| `@ndnci/translify-core`   | Scanning, parsing, extraction, sync, detection  |
| `@ndnci/translify-config` | Config loading, validation, and defaults        |
| `@ndnci/translify-ai`     | AI translation providers and batching           |
| `@ndnci/translify-shared` | Shared types, errors, constants, and utilities  |

## Data Flow

Most commands follow the same shape:

1. Resolve and validate `translify.config.*`
2. Scan source files and translation files
3. Load JSON translation files
4. Run the command-specific engine
5. Print a report or write deterministic changes

## AI Translation

AI providers implement `BaseTranslationProvider` in `packages/ai`. Current
providers are:

- `OpenAIProvider`
- `OpenRouterProvider`

`translateMissingKeys()` handles batching, split-file matching, optional
verification, values-only prompts, and usage aggregation before the CLI writes
results.

## More Detail

The full architecture notes live in the repository at
[`docs/ARCHITECTURE.md`](https://github.com/ndnci/translify/blob/main/docs/ARCHITECTURE.md).
