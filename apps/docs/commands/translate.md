# `translify translate`

Auto-translate missing keys using an AI provider.

## Requirements

- `ai_translation.enabled = true` in your config
- A valid `openai_api_key` (or `OPENAI_API_KEY` env var)

## Usage

```bash
# Translate all missing keys across all languages
translify translate

# Translate only French
translify translate --locale fr

# Preview without writing
translify translate --dry-run

# Re-translate all keys (including already-translated ones)
translify translate --all
```

## How it works

1. Reads your reference language (e.g. `en`) as the source
2. For each target language, finds keys with empty/missing values
3. Sends batches of key-value pairs to the AI provider
4. Writes the translations back to your JSON files

## Options

| Option            | Description                                  |
| ----------------- | -------------------------------------------- |
| `--locale <lang>` | Only translate a specific language           |
| `--all`           | Re-translate all keys, not just missing ones |
| `--dry-run`       | Preview without writing                      |
| `-c, --config`    | Path to config file                          |

## Providers

Currently supported:

- [OpenAI](/providers/openai) (GPT-4.1-mini, GPT-4.1, etc.)

More providers planned — see
[contributing](https://github.com/ndnci/translify/blob/main/CONTRIBUTING.md).
