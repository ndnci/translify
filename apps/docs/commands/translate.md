# `translify translate`

Auto-translate missing keys using an AI provider.

## Requirements

- `ai_translation.enabled = true` in your config
- A valid provider API key:
  - `openai_api_key` or `OPENAI_API_KEY` for OpenAI
  - `openrouter_api_key` or `OPENROUTER_API_KEY` for OpenRouter

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

For split translation projects such as `messages/en/auth.json` and
`messages/fr/auth.json`, Translify translates each target file from its matching
reference file. If no matching reference file exists, it falls back to the
merged reference-language catalogue.

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
- [OpenRouter](/providers/openrouter) (any OpenRouter model slug)

When the provider reports usage, the command prints prompt/completion/total
tokens. OpenRouter also reports USD cost when available.

If the provider rejects a request, Translify prints SDK details such as HTTP
status, provider code, provider message, and response body when available. This
is especially useful for invalid model slugs, quota failures, or provider-side
validation errors.

## AI translation options

```ts
ai_translation: {
  enabled: true,
  provider: 'openrouter',
  openrouter_api_key: process.env.OPENROUTER_API_KEY,
  model: 'anthropic/claude-sonnet-4',
  temperature: 0,
  batch_size: 50,
  verify: true,
  verify_model: 'openai/gpt-4.1-mini',
  values_only: true,
}
```

| Option         | Description                                                                  |
| -------------- | ---------------------------------------------------------------------------- |
| `batch_size`   | Maximum keys per provider call                                               |
| `verify`       | Runs a second LLM pass to verify and correct each translated batch           |
| `verify_model` | Optional model for the verification pass; defaults to `model`                |
| `values_only`  | Sends only source values to the AI and remaps translations by response order |
