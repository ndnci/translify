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
    throw new AIProviderError(this.name, formatProviderError(message, cause), cause);
  }
}

function formatProviderError(message: string, cause: unknown): string {
  const details = providerErrorDetails(cause);
  if (details.length === 0) return message;

  return `${message}\n\nProvider details:\n${details.map((detail) => `  - ${detail}`).join('\n')}`;
}

function providerErrorDetails(cause: unknown): string[] {
  const details: string[] = [];

  if (cause instanceof Error) {
    details.push(`${cause.name}: ${cause.message}`);
  } else if (typeof cause === 'string' && cause.trim()) {
    details.push(cause);
  }

  const source = asRecord(cause);
  if (source) {
    addField(details, 'HTTP status', source.status ?? source.statusCode);
    addField(details, 'Code', source.code);
    addField(details, 'Type', source.type);
    addField(details, 'Param', source.param);
    addField(details, 'Request ID', source.requestID ?? source.requestId);

    addNestedError(details, source.error);
    addResponseDetails(details, source.response);
    addBody(details, 'Response body', source.body ?? source.data);
  }

  return unique(details.map(redactSensitiveValues).map(limitDetailLength));
}

function addNestedError(details: string[], error: unknown): void {
  if (typeof error === 'string' && error.trim()) {
    details.push(`Provider error: ${error}`);
    return;
  }

  const record = asRecord(error);
  if (!record) return;

  addField(details, 'Provider message', record.message);
  addField(details, 'Provider code', record.code);
  addField(details, 'Provider type', record.type);
  addField(details, 'Provider param', record.param);
}

function addResponseDetails(details: string[], response: unknown): void {
  const record = asRecord(response);
  if (!record) return;

  addField(details, 'HTTP status', record.status ?? record.statusCode);
  addField(details, 'HTTP status text', record.statusText);
  addBody(details, 'Response body', record.data ?? record.body ?? record._data);
}

function addBody(details: string[], label: string, value: unknown): void {
  const serialized = serializeDetailValue(value);
  if (serialized) {
    details.push(`${label}: ${serialized}`);
  }
}

function addField(details: string[], label: string, value: unknown): void {
  const serialized = serializeDetailValue(value);
  if (serialized) {
    details.push(`${label}: ${serialized}`);
  }
}

function serializeDetailValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value !== 'object') return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as Record<string, unknown>;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function limitDetailLength(value: string): string {
  const maxLength = 1_500;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function redactSensitiveValues(value: string): string {
  return value
    .replace(/(authorization["']?\s*[:=]\s*["']?Bearer\s+)[^"',\s}]+/gi, '$1[redacted]')
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, '$1[redacted]')
    .replace(/\b(sk-(?:or-)?[A-Za-z0-9_-]{8,})\b/g, '[redacted]');
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
