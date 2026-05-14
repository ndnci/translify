import { AIProviderError } from '@ndnci/translify-shared';

// ─── Base interface ────────────────────────────────────────────────────────────

export interface TranslationRequest {
  /** Keys and their source-language values to translate */
  entries: Record<string, string>;
  /** BCP 47 tag of the source language, e.g. "en" */
  sourceLanguage: string;
  /** BCP 47 tag of the target language, e.g. "fr" */
  targetLanguage: string;
}

export interface TranslationResponse {
  /** Translated key-value pairs in the target language */
  translations: Record<string, string>;
  /** Provider name for logging */
  provider: string;
  /** Total tokens used (if applicable) */
  tokensUsed?: number;
}

/**
 * Contract that every AI translation provider must implement.
 *
 * Adding a new provider is as simple as implementing this interface.
 * See docs/HOW_TO_ADD_AI_PROVIDER.md for a step-by-step guide.
 */
export abstract class BaseTranslationProvider {
  abstract readonly name: string;

  /** Translate a batch of key-value pairs from source to target language */
  abstract translate(request: TranslationRequest): Promise<TranslationResponse>;

  /** Optional: check that the provider is correctly configured before use */
  async healthCheck(): Promise<void> {
    // Default: no-op. Override if needed.
  }

  protected throwProviderError(message: string, cause?: unknown): never {
    throw new AIProviderError(this.name, message, cause);
  }
}
