# `translify check-hardcoded`

Detect user-facing text that is hardcoded in source files.

## Usage

```bash
translify check-hardcoded
translify check-hardcoded --output report.json
```

## What it checks

Translify scans JSX text, common UI attributes such as `placeholder`, `title`,
`alt`, `label`, and `aria-label`, plus sentence-like string literals. Technical
strings such as imports, class names, routes, and existing translation keys are
ignored where possible.

Use `extraction.ignored_words`, `extraction.ignored_patterns`, and
`extraction.custom_regex_patterns` to exclude accepted words or patterns.

## Exit code

- `0` — no hardcoded user-facing text found
- `1` — one or more occurrences found
