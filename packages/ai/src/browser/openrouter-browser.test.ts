import { describe, expect, it, vi } from 'vitest';
import { translateTextWithOpenRouter } from './openrouter-browser.js';

describe('translateTextWithOpenRouter', () => {
  it('translates text directly through OpenRouter and returns usage details', async () => {
    const fetch: typeof globalThis.fetch = vi.fn(async (_input, init) => {
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer sk-or-test',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ndnci.github.io/translify/translator',
        'X-OpenRouter-Title': 'Translify',
      });

      const body = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ role: string; content: string }>;
        response_format: { type: string };
      };

      expect(body.model).toBe('openai/gpt-4.1-mini');
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(body.messages[0]?.content).toContain('Preserve all interpolation variables exactly');
      expect(body.messages[1]?.content).toContain('Hello {name}');

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"translation":"Bonjour {name}"}' } }],
          usage: {
            prompt_tokens: 19,
            completion_tokens: 6,
            total_tokens: 25,
            cost: 0.000012,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    await expect(
      translateTextWithOpenRouter(
        {
          apiKey: 'sk-or-test',
          model: 'openai/gpt-4.1-mini',
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          text: 'Hello {name}',
          httpReferer: 'https://ndnci.github.io/translify/translator',
        },
        fetch,
      ),
    ).resolves.toEqual({
      translation: 'Bonjour {name}',
      usage: {
        promptTokens: 19,
        completionTokens: 6,
        totalTokens: 25,
        costUsd: 0.000012,
      },
    });
  });

  it('surfaces the provider error without exposing the API key', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Invalid key sk-or-test', code: 401 } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await expect(
      translateTextWithOpenRouter(
        {
          apiKey: 'sk-or-test',
          model: 'openai/gpt-4.1-mini',
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          text: 'Hello',
        },
        fetch,
      ),
    ).rejects.toThrow('OpenRouter request failed (401): Invalid key [redacted]');
  });

  it('rejects empty credentials and input before making a request', async () => {
    const fetch = vi.fn();

    await expect(
      translateTextWithOpenRouter(
        {
          apiKey: '',
          model: 'openai/gpt-4.1-mini',
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          text: 'Hello',
        },
        fetch,
      ),
    ).rejects.toThrow('OpenRouter API key is required');

    expect(fetch).not.toHaveBeenCalled();
  });
});
