import { AIProviderError } from '@ndnci/translify-shared';

// ─── Base interface ────────────────────────────────────────────────────────────

export interface TranslationRequest {
  /** Keys and their source-language values to translate */
  entries: Record<string, string>;
  /** BCP 47 tag of the source language, e.g. "en" */
  sourceLanguage: string;
  /** BCP 47 tag of the target language, e.g. "fr" */
  targetLanguage: string;
  /** Send only values to the provider and remap translations by order */
  valuesOnly?: boolean;
  /** Run a verification/correction pass after the first translation */
  verify?: boolean;
  /** Model used for verification; defaults to the translation model */
  verifyModel?: string;
}

export interface TranslationUsage {
  /** Prompt/input tokens used by the provider, when reported */
  promptTokens?: number;
  /** Completion/output tokens used by the provider, when reported */
  completionTokens?: number;
  /** Total tokens used by the provider, when reported */
  totalTokens?: number;
  /** Total request cost in USD, when reported */
  costUsd?: number;
}

export interface TranslationResponse {
  /** Translated key-value pairs in the target language */
  translations: Record<string, string>;
  /** Provider name for logging */
  provider: string;
  /** Total tokens used (if applicable) */
  tokensUsed?: number;
  /** Provider usage and cost metrics, if available */
  usage?: TranslationUsage;
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

export function mergeTranslationUsage(
  current: TranslationUsage | undefined,
  next: TranslationUsage | undefined,
): TranslationUsage | undefined {
  if (!current) return next;
  if (!next) return current;

  const promptTokens = sumOptional(current.promptTokens, next.promptTokens);
  const completionTokens = sumOptional(current.completionTokens, next.completionTokens);
  const totalTokens = sumOptional(current.totalTokens, next.totalTokens);
  const costUsd = sumOptional(current.costUsd, next.costUsd);

  return {
    ...(promptTokens !== undefined && { promptTokens }),
    ...(completionTokens !== undefined && { completionTokens }),
    ...(totalTokens !== undefined && { totalTokens }),
    ...(costUsd !== undefined && { costUsd }),
  };
}

function sumOptional(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a + b;
}
