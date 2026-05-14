# `translify doctor`

Check your Translify setup and environment for common configuration problems.

## Usage

```bash
translify doctor
```

## Example output (all passing)

```
▸ Translify Doctor

  ✓ Node.js 22.4.0
  ✓ Config found: translify.config.ts
  ✓ Translation files (3 found)

✓ Everything looks good!
```

## Example output (with issues)

```
▸ Translify Doctor

  ✓ Node.js 22.4.0
  ✓ Config found: translify.config.ts
  ✗ Translation files (0 found)
    No files matched: messages/*.json
  ✗ AI provider: openai
    API key missing — set openai_api_key or OPENAI_API_KEY env var

⚠ Some checks failed. Review the output above.
```

## What it checks

| Check             | Description                                    |
| ----------------- | ---------------------------------------------- |
| Node.js version   | Must be 22+                                    |
| Config file       | Found and valid                                |
| Translation files | At least one file matches `translations.files` |
| AI provider key   | API key present when `ai_translation.enabled`  |

## Exit code

- `0` — all checks pass
- `1` — one or more checks failed
