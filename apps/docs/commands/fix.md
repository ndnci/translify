# `translify fix`

Fix deterministic audit issues. Hidden compatibility alias: `audit-fix`.

## Usage

```bash
translify fix --dry-run
translify fix --include missing,locale-consistency
translify fix --exclude unused
```

## Supported fixes

| Check                | Behavior                                             |
| -------------------- | ---------------------------------------------------- |
| `missing`            | Adds keys used in code but missing from translations |
| `unused`             | Removes keys not referenced in source files          |
| `duplicate-keys`     | Rewrites JSON files so duplicate declarations vanish |
| `locale-consistency` | Mirrors default-language keys into missing locales   |

Duplicate values and hardcoded text are reported by `audit` but are not changed
automatically because they require product or code decisions.

## Options

| Option               | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `--include <checks>` | Comma-separated checks to fix, default is all supported |
| `--exclude <checks>` | Comma-separated checks to skip                          |
| `--empty`            | Add missing values as empty strings                     |
| `--dry-run`          | Preview changes without writing files                   |
