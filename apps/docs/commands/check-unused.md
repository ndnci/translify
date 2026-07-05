# `translify check-unused`

> Formerly `translify unused` — the old name still works but is deprecated.

Detect translation keys that are defined in your JSON files but never referenced
in source code.

## Usage

```bash
translify check-unused
translify check-unused --verbose
translify check-unused --output report.json
```

## Example output

```
⚠ Found 5 unused keys

▸ Unused keys

  messages/en.json [en]
    ⚠ old.navbar.home          "Home"
    ⚠ deprecated.footer.link   "Privacy Policy"
    ⚠ beta.banner.text         "This feature is in beta"

  messages/fr.json [fr]
    ⚠ old.navbar.home          "Accueil"
    ⚠ deprecated.footer.link   "Politique de confidentialité"
```

## Options

| Option            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `--output <file>` | Write the report to a file (`.json` or plain text) |

## Exit code

- `0` — no unused keys found
- `1` — unused keys found

## Notes

Unused keys do not always mean they should be deleted. Some keys may be:

- Used dynamically: `t(\`${key}\`)` — Translify can't detect these statically
- Used in a part of your codebase not covered by `source.include`
- Intentionally kept for future use

Always review before removing.
