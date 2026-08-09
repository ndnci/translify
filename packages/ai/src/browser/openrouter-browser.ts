import {
  buildTextTranslationPrompt,
  buildTranslationSystemPrompt,
} from '../translation-prompts.js';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface BrowserTranslationRequest {
  apiKey: string;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
  httpReferer?: string;
  appTitle?: string;
}

export interface BrowserTranslationUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

export interface BrowserTranslationResult {
  translation: string;
  usage?: BrowserTranslationUsage;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
    cost?: unknown;
  };
  error?: { message?: unknown };
}

/**
 * Browser-safe OpenRouter client used by the serverless translation playground.
 * The API key is sent directly to OpenRouter and is never sent to Translify.
 */
export async function translateTextWithOpenRouter(
  request: BrowserTranslationRequest,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<BrowserTranslationResult> {
  const apiKey = request.apiKey.trim();
  const model = request.model.trim();
  const text = request.text.trim();

  if (!apiKey) throw new Error('OpenRouter API key is required');
  if (!model) throw new Error('OpenRouter model is required');
  if (!text) throw new Error('Text to translate is required');
  if (!request.sourceLanguage.trim()) throw new Error('Source language is required');
  if (!request.targetLanguage.trim()) throw new Error('Target language is required');
  if (typeof fetcher !== 'function') throw new Error('Fetch is not available in this browser');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-OpenRouter-Title': request.appTitle?.trim() || 'Translify',
  };
  if (request.httpReferer?.trim()) {
    headers['HTTP-Referer'] = request.httpReferer.trim();
  }

  let response: Response;
  try {
    response = await fetcher(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildTranslationSystemPrompt('Return only the requested JSON object.'),
          },
          {
            role: 'user',
            content: buildTextTranslationPrompt(
              text,
              request.sourceLanguage.trim(),
              request.targetLanguage.trim(),
            ),
          },
        ],
      }),
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Could not reach OpenRouter: ${redact(detail, apiKey)}`, { cause });
  }

  const payload = await readResponse(response);
  if (!response.ok) {
    const detail =
      typeof payload.error?.message === 'string'
        ? payload.error.message
        : response.statusText || 'Unknown provider error';
    throw new Error(`OpenRouter request failed (${response.status}): ${redact(detail, apiKey)}`);
  }

  const rawContent = payload.choices?.[0]?.message?.content;
  if (typeof rawContent !== 'string') {
    throw new Error('OpenRouter returned no translation');
  }

  const translation = parseTranslation(rawContent);
  const usage = parseUsage(payload.usage);

  return {
    translation,
    ...(usage && { usage }),
  };
}

async function readResponse(response: Response): Promise<OpenRouterResponse> {
  try {
    return (await response.json()) as OpenRouterResponse;
  } catch (cause) {
    if (!response.ok) {
      return { error: { message: response.statusText || 'Invalid provider response' } };
    }
    throw new Error('OpenRouter returned an invalid JSON response', { cause });
  }
}

function parseTranslation(content: string): string {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(cleaned) as { translation?: unknown };
    if (typeof parsed.translation === 'string' && parsed.translation.trim()) {
      return parsed.translation;
    }
  } catch (cause) {
    throw new Error('OpenRouter returned a translation that was not valid JSON', { cause });
  }

  throw new Error('OpenRouter returned no translation');
}

function parseUsage(usage: OpenRouterResponse['usage']): BrowserTranslationUsage | undefined {
  if (!usage) return undefined;

  const promptTokens = finiteNumber(usage.prompt_tokens);
  const completionTokens = finiteNumber(usage.completion_tokens);
  const totalTokens = finiteNumber(usage.total_tokens);
  const costUsd = finiteNumber(usage.cost);

  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalTokens === undefined &&
    costUsd === undefined
  ) {
    return undefined;
  }

  return {
    ...(promptTokens !== undefined && { promptTokens }),
    ...(completionTokens !== undefined && { completionTokens }),
    ...(totalTokens !== undefined && { totalTokens }),
    ...(costUsd !== undefined && { costUsd }),
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function redact(value: string, apiKey: string): string {
  return apiKey ? value.split(apiKey).join('[redacted]') : value;
}
