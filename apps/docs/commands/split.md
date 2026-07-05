# `translify split`

Split large locale JSON files into multiple files by context. Alias: `extract`.

## Usage

```bash
translify split --dry-run
translify split --groups tools=tool,auth=auth
translify split --output-pattern "messages/{language}/{group}.json"
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

Use `--groups` when several top-level contexts should share a file. For example,
`--groups tools=tool` puts keys such as `ToolsPage.*` and
`AiImageGeneratorTool.*` into `tools.json`.

## Options

| Option                       | Description                                  |
| ---------------------------- | -------------------------------------------- | ----- |
| `--depth <number>`           | Dot-key depth used for default grouping      |
| `--groups <groups>`          | Custom groups, e.g. `tools=tool,auth=login   | auth` |
| `--output-pattern <pattern>` | Path pattern with `{language}` and `{group}` |
| `--keep-source`              | Keep the original monolithic files           |
| `--dry-run`                  | Preview changes without writing files        |
