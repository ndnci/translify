# `translify split-translations`

Split large locale JSON files into multiple files by context.

## Usage

```bash
translify split-translations --dry-run
translify split-translations --groups "tools=tool|foo,auth=auth"
translify split-translations --groups "legal=privacy|terms" --group-match both
translify split-translations --output-pattern "messages/{language}/{group}.json"
```

## Grouping

By default, Translify groups by the first dot-key segment:

```json
{
  "auth": { "login": "Log in" },
  "tools": { "title": "Tools" }
}
```

becomes:

```text
messages/en/auth.json
messages/en/tools.json
```

Use `--groups` when several contexts should share a file. For example,
`--groups "tools=tool|foo"` puts keys such as `ToolsPage.*`,
`AiImageGeneratorTool.*`, and `FooPage.*` into `tools.json`.

By default, custom group matchers inspect full dot-keys. Use
`--group-match values` to match translated values instead, or
`--group-match both` to allow either keys or values to match.

## Options

| Option                       | Description                                      |
| ---------------------------- | ------------------------------------------------ |
| `--depth <number>`           | Dot-key depth used for default grouping          |
| `--groups <groups>`          | Custom groups, e.g. `tools=tool\|foo,auth=login` |
| `--group-match <mode>`       | Match `keys`, `values`, or `both`                |
| `--output-pattern <pattern>` | Path pattern with `{language}` and `{group}`     |
| `--keep-source`              | Keep the original monolithic files               |
| `--dry-run`                  | Preview changes without writing files            |
