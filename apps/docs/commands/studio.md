# `translify studio`

Open a local translation workspace in your default browser.

```bash
translify studio

# Pick another port or open the URL yourself
translify studio --port 5174
translify studio --no-open
```

The server only listens on `127.0.0.1`. Stop it with <kbd>Ctrl</kbd> +
<kbd>C</kbd>.

## Translator

The landing page is a free-form translator powered by the provider and model in
`translify.config`. It reports input, output and total tokens when the provider
returns them, plus USD cost for OpenRouter requests when available.

## Translation catalogue

The sidebar groups matching locale files into one logical item. For example,
`messages/en/common.json` and `messages/fr/common.json` appear once as
`messages/common`; choose the current locale from the header.

The catalogue lets you:

- search keys and values;
- show missing or completed entries;
- put the default or current language first;
- edit a value directly without reformatting the rest of its JSON file;
- translate a value with AI, regenerate it, or request 1–10 alternatives;
- choose an alternative or regenerate from one candidate;
- inspect provider token and cost metadata for every AI request.

## Requirements

Manual catalogue editing works without AI. Translation actions require
`ai_translation.enabled = true` and the configured provider API key, just like
[`translify translate`](/commands/translate).

| Option         | Description                                    |
| -------------- | ---------------------------------------------- |
| `-p, --port`   | Local port (default: `4983`)                   |
| `--no-open`    | Do not automatically open the browser          |
| `-c, --config` | Path to a Translify config file                |
| `--cwd <path>` | Project directory containing translation files |
