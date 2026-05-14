# `translify audit`

Run a full i18n health audit — all checks in one pass.

## Usage

```bash
translify audit
translify audit --verbose
translify audit --config ./config/translify.config.ts
```

## What it checks

| Check            | Description                                           |
| ---------------- | ----------------------------------------------------- |
| Missing keys     | Keys used in source but absent from translation files |
| Unused keys      | Keys in translation files never referenced in code    |
| Duplicate values | Multiple keys sharing the same translated string      |

## Example output

```
▸ Translify Audit 2024-01-15T10:30:00.000Z

▸ Overview
  Source files         42
  Translation files    3
  Unique keys used     187

▸ Checks
  ✓ Missing keys           none
  ✗ Unused keys            12
  ✓ Duplicate values       none

▸ Unused keys
  ⚠ [en] old.navbar.home
  ⚠ [en] deprecated.footer.link
  …

⚠ Audit found issues. Review the output above.
```

## Exit code

- `0` — all checks passed
- `1` — one or more issues found

This makes it safe to use in CI pipelines:

```yaml
- run: npx @ndnci/translify@latest audit
```

## Options

| Option         | Description         |
| -------------- | ------------------- |
| `-c, --config` | Path to config file |
| `--cwd`        | Working directory   |
| `--verbose`    | Show all details    |
