# How to Add a New AI Translation Provider

This guide explains how to integrate a new AI service (DeepL, Google Translate,
Mistral AI, etc.) into Translify's translation pipeline.

---

## Background

The AI package (`packages/ai`) uses a **provider pattern**:

```
BaseTranslationProvider (abstract class)
    └── OpenAIProvider
    └── OpenRouterProvider
    └── YourNewProvider  ← you add this
```

Each provider implements a single method: `translate(request)`.

---

## Step 1 — Create your provider file

Create `packages/ai/src/providers/<provider-name>-provider.ts`:

```typescript
import {
  BaseTranslationProvider,
  type TranslationRequest,
  type TranslationResponse,
  type TranslationUsage,
} from './base-provider.js';
import { MissingApiKeyError } from '@ndnci/translify-shared';

export interface DeepLProviderOptions {
  apiKey: string;
  /** 'free' or 'pro' (default: 'free') */
  plan?: 'free' | 'pro';
}

export class DeepLProvider extends BaseTranslationProvider {
  readonly name = 'deepl';

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: DeepLProviderOptions) {
    super();

    if (!options.apiKey) {
      throw new MissingApiKeyError('deepl', 'DEEPL_API_KEY');
    }

    this.apiKey = options.apiKey;
    this.baseUrl =
      options.plan === 'pro'
        ? 'https://api.deepl.com'
        : 'https://api-free.deepl.com';
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    if (Object.keys(request.entries).length === 0) {
      return { translations: {}, provider: this.name };
    }

    // Translate values (preserve keys)
    const texts = Object.values(request.entries);

    const response = await fetch(`${this.baseUrl}/v2/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: texts,
        source_lang: request.sourceLanguage.toUpperCase(),
        target_lang: request.targetLanguage.toUpperCase(),
        tag_handling: 'xml', // preserves {interpolation} as XML tags
        ignore_tags: ['interp'],
      }),
    });

    if (!response.ok) {
      this.throwProviderError(
        `DeepL API returned ${response.status}: ${await response.text()}`,
      );
    }

    const data = (await response.json()) as {
      translations: Array<{ text: string }>;
    };

    const keys = Object.keys(request.entries);
    const translations = Object.fromEntries(
      keys.map((key, i) => [key, data.translations[i]?.text ?? '']),
    );

    const usage: TranslationUsage | undefined = undefined;

    return { translations, provider: this.name, ...(usage && { usage }) };
  }

  async healthCheck(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v2/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}` },
    });
    if (!response.ok) {
      this.throwProviderError(
        'Health check failed — could not reach DeepL API.',
      );
    }
  }
}
```

---

## Step 2 — Add to the config schema

In `packages/shared/src/types/config.ts`, extend the `provider` enum:

```typescript
// Before:
provider: z.enum(['openai', 'openrouter']).default('openai'),

// After:
provider: z.enum(['openai', 'openrouter', 'deepl']).default('openai'),
```

Add the new API key field:

```typescript
deepl_api_key: z.string().optional(),
```

Add a cross-field validation:

```typescript
.superRefine((data, ctx) => {
  if (data.enabled && data.provider === 'deepl' && !data.deepl_api_key) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['deepl_api_key'],
      message: 'deepl_api_key is required when provider is "deepl".',
    });
  }
  // ... existing openai/openrouter checks ...
});
```

---

## Step 3 — Wire up in `createProvider()`

In `packages/ai/src/translator.ts`:

```typescript
import { DeepLProvider } from './providers/deepl-provider.js';

export function createProvider(config: TranslifyConfig['ai_translation']): BaseTranslationProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider({ apiKey: config.openai_api_key!, ... });

    case 'openrouter':
      return new OpenRouterProvider({ apiKey: config.openrouter_api_key!, ... });

    case 'deepl':
      return new DeepLProvider({ apiKey: config.deepl_api_key! });

    default: {
      const _never: never = config.provider;
      throw new Error(`Unknown AI provider: ${String(_never)}`);
    }
  }
}
```

---

## Step 4 — Export the new provider

In `packages/ai/src/providers/index.ts`:

```typescript
export { DeepLProvider } from './deepl-provider.js';
export type { DeepLProviderOptions } from './deepl-provider.js';
```

---

## Step 5 — Add documentation

Create `apps/docs/providers/deepl.md` describing setup and usage.

Update `apps/docs/.vitepress/config.ts` to add it to the sidebar.

Also update:

- `README.md`
- `apps/docs/commands/translate.md`
- `apps/docs/guide/configuration.md`
- `CHANGELOG.md`

---

## Step 6 — Add usage metrics when available

If the provider reports token usage or cost, include it in
`TranslationResponse.usage`:

```typescript
return {
  translations,
  provider: this.name,
  usage: {
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
  },
};
```

The CLI automatically aggregates these metrics for `translify translate`.

## Step 7 — Add a changeset and submit a PR

```bash
pnpm changeset
# Select: packages/ai → minor (new feature)
# Select: packages/config → minor
```

Follow [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Notes on interpolation

Different providers handle interpolation variables differently. OpenAI is
prompted to preserve them; DeepL can use XML tag handling. Make sure your
provider correctly round-trips strings like `{name}`, `{{count}}`, and `%s`.

Test with fixture strings that contain variables.
