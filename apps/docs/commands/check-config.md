# `translify check-config`

Validate the Translify config file.

## Usage

```bash
translify check-config
translify check-config --config ./config/translify.config.ts
```

## What it checks

- The config file exists and can be loaded.
- All values match the expected schema.
- Unknown keys are rejected, which catches typos and misplaced options.
- AI translation requirements are valid when enabled.

## Exit code

- `0` — config is valid
- `1` — config is missing, cannot be loaded, or is invalid
