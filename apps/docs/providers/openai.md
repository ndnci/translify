# OpenAI Provider

Translify uses the official `openai` npm package to translate your i18n keys.

## Setup

```ts
// translify.config.ts
export default {
  ai_translation: {
    enabled: true,
    provider: 'openai',
    openai_api_key: process.env.OPENAI_API_KEY,
    model: 'gpt-4.1-mini', // fast and affordable
    temperature: 0, // deterministic (best for translations)
    batch_size: 50, // keys per API call
    verify: false,
    values_only: false,
  },
};
```

Set your API key:

```bash
export OPENAI_API_KEY=sk-...
```

## Models

| Model          | Speed  | Quality | Cost   |
| -------------- | ------ | ------- | ------ |
| `gpt-4.1-mini` | Fast   | Good    | Low    |
| `gpt-4.1`      | Medium | High    | Medium |
| `gpt-4o`       | Medium | High    | Medium |

We recommend `gpt-4.1-mini` for most projects.

## Interpolation variables

The provider automatically preserves interpolation variables:

```json
{ "greeting": "Hello, {name}!" }
```

Translates to French as:

```json
{ "greeting": "Bonjour, {name} !" }
```

## Rate limits and batching

`batch_size` controls how many keys are sent per API call (default: `50`).
Reduce this if you hit rate limits on your OpenAI plan.

OpenAI reports token usage, so `translify translate` prints prompt, completion,
and total tokens when the API returns them. Cost reporting is provider-specific
and is currently available with OpenRouter.
