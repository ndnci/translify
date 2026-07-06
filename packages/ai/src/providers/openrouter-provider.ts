import { OpenRouter } from '@openrouter/sdk';
import { MissingApiKeyError } from '@ndnci/translify-shared';
import {
  BaseTranslationProvider,
  type TranslationRequest,
  type TranslationResponse,
  type TranslationUsage,
  mergeTranslationUsage,
} from './base-provider.js';

export interface OpenRouterProviderOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  httpReferer?: string;
  appTitle?: string;
}

type ChatUsageLike = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number | null | undefined;
};

/**
 * OpenRouter translation provider.
 *
 * Uses the official @openrouter/sdk client, allowing any OpenRouter model slug
 * while preserving Translify's provider contract.
 */
export class OpenRouterProvider extends BaseTranslationProvider {
  readonly name = 'openrouter';

  private readonly client: OpenRouter;
  private readonly model: string;
  private readonly temperature: number;

  constructor(options: OpenRouterProviderOptions) {
    super();

    if (!options.apiKey) {
      throw new MissingApiKeyError('openrouter', 'OPENROUTER_API_KEY');
    }

    this.client = new OpenRouter({
      apiKey: options.apiKey,
      httpReferer: options.httpReferer,
      appTitle: options.appTitle ?? 'Translify',
    });
    this.model = options.model ?? 'openai/gpt-4.1-mini';
    this.temperature = options.temperature ?? 0;
  }

  override async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const keyCount = Object.keys(request.entries).length;
    if (keyCount === 0) {
      return { translations: {}, provider: this.name };
    }

    try {
      const translated = await this.translateOnce(request, this.model);
      let translations = translated.translations;
      let usage = translated.usage;

      if (request.verify) {
        const verified = await this.verifyTranslations(
          request,
          translations,
          request.verifyModel ?? this.model,
        );
        translations = verified.translations;
        usage = mergeTranslationUsage(usage, verified.usage);
      }

      const tokensUsed = usage?.totalTokens;

      return {
        translations,
        provider: this.name,
        ...(tokensUsed !== undefined && { tokensUsed }),
        ...(usage && { usage }),
      };
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AIProviderError') throw cause;
      this.throwProviderError(
        'API call failed. Check your API key, model slug, network connection, and rate limits.',
        cause,
      );
    }
  }

  override async healthCheck(): Promise<void> {
    try {
      await this.client.models.list();
    } catch (cause) {
      this.throwProviderError('Health check failed — could not reach OpenRouter API.', cause);
    }
  }

  private async translateOnce(
    request: TranslationRequest,
    model: string,
  ): Promise<{ translations: Record<string, string>; usage?: TranslationUsage }> {
    const response = await this.client.chat.send({
      chatRequest: {
        model,
        temperature: this.temperature,
        responseFormat: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a professional software localization expert. ' +
              'Translate i18n strings accurately and naturally. ' +
              'Preserve all interpolation variables exactly as-is (e.g. {name}, {{count}}, %s). ' +
              (request.valuesOnly
                ? 'Return ONLY a valid JSON object with an "items" array containing translated values in the same order. '
                : 'Return ONLY a valid JSON object with the same keys and translated values. ') +
              'Do not add explanations or comments.',
          },
          { role: 'user', content: this.buildPrompt(request) },
        ],
      },
    });

    const raw = String(response.choices[0]?.message?.content ?? '{}');
    const translations = request.valuesOnly
      ? this.parseValuesOnlyResponse(raw, request)
      : this.parseKeyedResponse(raw, request, 'Translation');
    const usage = await this.usageFromResponse(response.id, response.usage);

    return { translations, ...(usage && { usage }) };
  }

  private async verifyTranslations(
    request: TranslationRequest,
    translations: Record<string, string>,
    model: string,
  ): Promise<{ translations: Record<string, string>; usage?: TranslationUsage }> {
    const response = await this.client.chat.send({
      chatRequest: {
        model,
        temperature: 0,
        responseFormat: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a senior localization reviewer. Verify that each translation is accurate, natural, and preserves interpolation variables exactly. ' +
              'Return ONLY a valid JSON object with the same keys and the corrected translated values. Do not add explanations.',
          },
          {
            role: 'user',
            content:
              `Source language: "${request.sourceLanguage}"\n` +
              `Target language: "${request.targetLanguage}"\n\n` +
              `Source JSON:\n${JSON.stringify(request.entries, null, 2)}\n\n` +
              `Candidate translations:\n${JSON.stringify(translations, null, 2)}`,
          },
        ],
      },
    });

    const raw = String(response.choices[0]?.message?.content ?? '{}');
    const verified = this.parseKeyedResponse(raw, request, 'Verification');
    const usage = await this.usageFromResponse(response.id, response.usage);

    return { translations: verified, ...(usage && { usage }) };
  }

  private buildPrompt(request: TranslationRequest): string {
    if (request.valuesOnly) {
      return (
        `Translate each value in this JSON array from "${request.sourceLanguage}" to "${request.targetLanguage}".\n` +
        'Return ONLY a JSON object shaped as {"items":[...]} with the same length and order.\n\n' +
        JSON.stringify(Object.values(request.entries), null, 2)
      );
    }

    return (
      `Translate the following JSON from "${request.sourceLanguage}" to "${request.targetLanguage}".\n\n` +
      JSON.stringify(request.entries, null, 2)
    );
  }

  private parseKeyedResponse(
    raw: string,
    request: TranslationRequest,
    label: string,
  ): Record<string, string> {
    let translations: Record<string, string>;
    try {
      translations = JSON.parse(raw) as Record<string, string>;
    } catch {
      this.throwProviderError(`${label} response was not valid JSON.\n\nRaw response:\n${raw}`);
    }

    const missing = Object.keys(request.entries).filter((k) => !(k in translations));
    if (missing.length > 0) {
      this.throwProviderError(
        this.incompleteKeyedResponseMessage(label, missing, Object.keys(request.entries).length),
      );
    }

    return Object.fromEntries(
      Object.keys(request.entries).map((key) => [key, String(translations[key] ?? '')]),
    );
  }

  private parseValuesOnlyResponse(
    raw: string,
    request: TranslationRequest,
  ): Record<string, string> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      this.throwProviderError(`Translation response was not valid JSON.\n\nRaw response:\n${raw}`);
    }

    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : null;

    const keys = Object.keys(request.entries);
    if (!items || items.length !== keys.length) {
      this.throwProviderError(
        this.incompleteValuesResponseMessage(keys.length, items?.length ?? 'none'),
      );
    }

    return Object.fromEntries(keys.map((key, index) => [key, String(items[index] ?? '')]));
  }

  private async usageFromResponse(
    generationId: string,
    usage: ChatUsageLike | undefined,
  ): Promise<TranslationUsage | undefined> {
    let result = this.usageFromChat(usage);

    try {
      const generation = await this.client.generations.getGeneration({ id: generationId });
      result = mergeTranslationUsage(result, {
        ...(generation.data.tokensPrompt !== null && {
          promptTokens: generation.data.tokensPrompt,
        }),
        ...(generation.data.tokensCompletion !== null && {
          completionTokens: generation.data.tokensCompletion,
        }),
        ...((generation.data.tokensPrompt !== null ||
          generation.data.tokensCompletion !== null) && {
          totalTokens:
            (generation.data.tokensPrompt ?? 0) + (generation.data.tokensCompletion ?? 0),
        }),
        costUsd: generation.data.totalCost,
      });
    } catch {
      // Usage metadata is best-effort; the chat response often already has it.
    }

    return result;
  }

  private usageFromChat(usage: ChatUsageLike | undefined): TranslationUsage | undefined {
    if (!usage) return undefined;
    return {
      ...(usage.promptTokens !== undefined && { promptTokens: usage.promptTokens }),
      ...(usage.completionTokens !== undefined && {
        completionTokens: usage.completionTokens,
      }),
      ...(usage.totalTokens !== undefined && { totalTokens: usage.totalTokens }),
      ...(usage.cost !== undefined && usage.cost !== null && { costUsd: usage.cost }),
    };
  }
}
