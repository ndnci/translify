# Choosing an AI model

Translation workloads are usually high-volume and easy to evaluate on a fixed
catalogue. Start with the inexpensive option, then compare terminology,
placeholder preservation, JSON validity, latency, and total cost on your own
messages before moving to a larger model.

## Recommended defaults

### OpenRouter: DeepSeek V4 Flash

Use `deepseek/deepseek-v4-flash` when cost is the priority:

```ts
ai_translation: {
  enabled: true,
  provider: 'openrouter',
  openrouter_api_key: process.env.OPENROUTER_API_KEY,
  model: 'deepseek/deepseek-v4-flash',
}
```

OpenRouter describes DeepSeek V4 Flash as an efficiency-optimized,
high-throughput model with strong performance and a one-million-token context
window. Its price depends on the routed provider and current discounts; use the
[live OpenRouter model page](https://openrouter.ai/deepseek/deepseek-v4-flash)
instead of copying a price into long-lived configuration.

This is also the default model shown in the browser translator.

### OpenAI: GPT-5.6 Luna

Use `gpt-5.6-luna` when calling OpenAI directly:

```ts
ai_translation: {
  enabled: true,
  provider: 'openai',
  openai_api_key: process.env.OPENAI_API_KEY,
  model: 'gpt-5.6-luna',
}
```

The
[official OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
positions Luna for cost-sensitive, high-volume workloads. It is Translify's
recommended OpenAI default. Use `gpt-5.6-terra` when an evaluation shows that
the extra quality is worth the price, and `gpt-5.6-sol` for difficult,
quality-first batches.

OpenRouter model slugs and OpenAI model IDs are not interchangeable. For
example, use `gpt-5.6-luna` with the OpenAI provider and `openai/gpt-5.6-luna`
when that model is available through OpenRouter.

## Real Translify runs

These captures come from three real OpenRouter runs against the same 1,680-key
project. They demonstrate what Translify records after each file and for the
whole run; they are examples, not price guarantees. The model slug is not shown
in the captured terminal output, so compare the billed amount with your own
configured model rather than attributing these numbers to a specific model.

### Spanish — 1,680 keys, 114,122 tokens, $0.0229

![Translify translating 1,680 keys to Spanish with per-file token and cost totals](/images/translation-costs/spanish.png)

### Danish — 1,680 keys, 97,008 tokens, $0.0224

![Translify translating 1,680 keys to Danish with per-file token and cost totals](/images/translation-costs/danish.png)

### Swedish — 1,680 keys, 52,125 tokens, $0.009429

![Translify translating 1,680 keys to Swedish with per-file token and cost totals](/images/translation-costs/swedish.png)

Different target languages can produce very different completion-token counts.
Treat cost per key as a measured range, keep `batch_size` stable during a model
comparison, and review a representative sample before translating an entire
repository.
