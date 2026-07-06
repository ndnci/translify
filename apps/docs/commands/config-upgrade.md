# `translify config-upgrade`

Add newly supported config keys to an existing Translify config without
overwriting existing values.

## Usage

```bash
translify config-upgrade
translify config-upgrade --dry-run
translify --config ./translify.config.ts config-upgrade
```

## What It Updates

The command adds missing defaults for current config sections, including:

- `translations.split`
- `detection`
- `ai_translation.openrouter_api_key`
- `ai_translation.batch_size`
- `ai_translation.verify`
- `ai_translation.verify_model`
- `ai_translation.values_only`

Existing values are preserved. For example, if your config already has
`model: 'gpt-4.1'`, `config-upgrade` keeps that model and only adds missing
fields around it.

## Options

| Option         | Description                     |
| -------------- | ------------------------------- |
| `--dry-run`    | Preview changes without writing |
| `-c, --config` | Path to config file             |
| `--cwd`        | Working directory               |
