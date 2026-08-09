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

# Translate only one split translation file
translify translate --file messages/fr/common.json

# Translate multiple specific files
translify translate --file messages/fr/common.json --file messages/fr/legal.json
translify translate --file messages/fr/common.json,messages/fr/legal.json

# Preview without writing
translify translate --dry-run

# Re-translate all keys (including already-translated ones)
translify translate --all

# Keep the old compact spinner-only progress output
translify translate --no-details

# Force checkpoint behavior for interrupted/failed runs
translify translate --resume
translify translate --restart
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

| Option            | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `--locale <lang>` | Only translate a specific language                           |
| `--file <path>`   | Only translate specific files; repeatable or comma-separated |
| `--all`           | Re-translate all keys, not just missing ones                 |
| `--no-details`    | Use compact spinner-only progress output                     |
| `--resume`        | Resume a saved translate checkpoint                          |
| `--restart`       | Discard a saved checkpoint and start fresh                   |
| `--dry-run`       | Preview without writing                                      |
| `-c, --config`    | Path to config file                                          |

By default, `translate` shows a detailed progress view grouped by locale, with
one progress bar per translation file and counts like `(126/2396)` for
translated keys versus total keys to translate.

Without `--all`, Translify only fills missing or empty values. With `--all`, it
re-translates already-filled values too. Use `--file` to restrict translation to
one or more configured translation JSON files; it can be combined with
`--locale`.

## Resume failed translations

During a real translation run, Translify writes completed batches to
`.translify/translate-checkpoint.json`. If the provider returns an incomplete
response, the network fails, or the process is interrupted, rerun the same
command to resume from the saved checkpoint instead of retranslating completed
batches.

In an interactive terminal, Translify asks whether to resume. In non-interactive
environments it resumes automatically when the checkpoint matches the same
command/config/files. Use `--resume` to force resume, or `--restart` to discard
the checkpoint and start over. The checkpoint is removed after a successful run.

## Providers

Currently supported:

- [OpenAI](/providers/openai) (`gpt-5.6-luna` recommended)
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
  model: 'deepseek/deepseek-v4-flash',
  temperature: 0,
  batch_size: 50,
  verify: true,
  verify_model: 'deepseek/deepseek-v4-flash',
  values_only: true,
}
```

| Option         | Description                                                                  |
| -------------- | ---------------------------------------------------------------------------- |
| `batch_size`   | Maximum keys per provider call                                               |
| `verify`       | Runs a second LLM pass to verify and correct each translated batch           |
| `verify_model` | Optional model for the verification pass; defaults to `model`                |
| `values_only`  | Sends only source values to the AI and remaps translations by response order |
