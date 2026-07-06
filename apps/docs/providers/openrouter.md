# OpenRouter Provider

Translify uses the official `@openrouter/sdk` package to translate your i18n
keys through OpenRouter.

## Setup

```ts
// translify.config.ts
export default {
  ai_translation: {
    enabled: true,
    provider: 'openrouter',
    openrouter_api_key: process.env.OPENROUTER_API_KEY,
    model: 'anthropic/claude-sonnet-4',
    temperature: 0,
    batch_size: 50,
    verify: false,
    values_only: false,
  },
};
```

Set your API key:

```bash
export OPENROUTER_API_KEY=sk-or-...
```

## Models

Use any model slug from the OpenRouter catalogue:

```ts
model: 'openai/gpt-4.1-mini';
model: 'anthropic/claude-sonnet-4';
model: 'google/gemini-2.5-flash';
```

## Usage And Cost

OpenRouter reports token usage and cost when available. After
`translify translate`, Translify prints prompt tokens, completion tokens, total
tokens, and total USD cost.

## Verification

Enable a second LLM pass when you want the translated batch checked and
corrected before writing:

```ts
ai_translation: {
  provider: 'openrouter',
  verify: true,
  verify_model: 'openai/gpt-4.1-mini',
}
```

If `verify_model` is omitted, Translify uses the same `model` for translation
and verification.

## Values Only Mode

By default, Translify sends key-value pairs to the provider. If you want to send
only source text values, enable:

```ts
ai_translation: {
  values_only: true,
}
```

The provider must return the same number of translated values in the same order;
Translify then maps them back to the original keys.
