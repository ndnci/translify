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
    model: 'gpt-5.6-luna', // recommended for cost-sensitive workloads
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

| Model           | Best fit                                      |
| --------------- | --------------------------------------------- |
| `gpt-5.6-luna`  | Cost-sensitive, high-volume translation       |
| `gpt-5.6-terra` | Higher quality while balancing cost           |
| `gpt-5.6-sol`   | Quality-first translation and difficult cases |

We recommend `gpt-5.6-luna` as the direct OpenAI starting point. OpenAI
describes it as the GPT-5.6 model for cost-sensitive, high-volume workloads.
Model pricing changes; follow the live OpenAI model page and run a
representative translation sample before choosing a production default.

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
