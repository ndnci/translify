import OpenAI from 'openai';
import { MissingApiKeyError } from '@ndnci/translify-shared';
import {
  BaseTranslationProvider,
  type TranslationRequest,
  type TranslationResponse,
} from './base-provider.js';

export interface OpenAIProviderOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
}

/**
 * OpenAI translation provider.
 *
 * Uses a structured JSON prompt to translate batches of i18n keys
 * while preserving interpolation variables (e.g. {name}, {{count}}).
 */
export class OpenAIProvider extends BaseTranslationProvider {
  readonly name = 'openai';

  private readonly client: OpenAI;
  private readonly model: string;
  private readonly temperature: number;

  constructor(options: OpenAIProviderOptions) {
    super();

    if (!options.apiKey) {
      throw new MissingApiKeyError('openai', 'OPENAI_API_KEY');
    }

    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? 'gpt-4.1-mini';
    this.temperature = options.temperature ?? 0;
  }

  override async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const keyCount = Object.keys(request.entries).length;
    if (keyCount === 0) {
      return { translations: {}, provider: this.name };
    }

    const prompt = this.buildPrompt(request);

    let raw: string;
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a professional software localization expert. ' +
              'Translate i18n JSON key-value pairs accurately and naturally. ' +
              'Preserve all interpolation variables exactly as-is (e.g. {name}, {{count}}, %s). ' +
              'Return ONLY a valid JSON object with the same keys and translated values. ' +
              'Do not add explanations or comments.',
          },
          { role: 'user', content: prompt },
        ],
      });

      raw = response.choices[0]?.message?.content ?? '{}';
      const tokensUsed = response.usage?.total_tokens;

      let translations: Record<string, string>;
      try {
        translations = JSON.parse(raw) as Record<string, string>;
      } catch {
        this.throwProviderError(`Response was not valid JSON.\n\nRaw response:\n${raw}`);
      }

      // Validate that all input keys are present in the response
      const missing = Object.keys(request.entries).filter((k) => !(k in translations));
      if (missing.length > 0) {
        this.throwProviderError(`Translation response is missing keys: ${missing.join(', ')}`);
      }

      return {
        translations,
        provider: this.name,
        ...(tokensUsed !== undefined && { tokensUsed }),
      };
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AIProviderError') throw cause;
      this.throwProviderError(
        'API call failed. Check your API key, network connection, and rate limits.',
        cause,
      );
    }
  }

  override async healthCheck(): Promise<void> {
    try {
      await this.client.models.list();
    } catch (cause) {
      this.throwProviderError('Health check failed — could not reach OpenAI API.', cause);
    }
  }

  private buildPrompt(request: TranslationRequest): string {
    return (
      `Translate the following JSON from "${request.sourceLanguage}" to "${request.targetLanguage}".\n\n` +
      JSON.stringify(request.entries, null, 2)
    );
  }
}
