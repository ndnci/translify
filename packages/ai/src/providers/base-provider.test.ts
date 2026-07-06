import { describe, expect, it } from 'vitest';
import { AIProviderError } from '@ndnci/translify-shared';
import {
  BaseTranslationProvider,
  type TranslationRequest,
  type TranslationResponse,
} from './base-provider.js';

class TestProvider extends BaseTranslationProvider {
  readonly name = 'test-provider';

  async translate(_request: TranslationRequest): Promise<TranslationResponse> {
    return { translations: {}, provider: this.name };
  }

  fail(cause: unknown): never {
    this.throwProviderError('API call failed. Check your API key and model slug.', cause);
  }

  failIncomplete(): never {
    this.throwProviderError(
      this.incompleteKeyedResponseMessage(
        'Translation',
        ['LegalPage.s4Title', 'LegalPage.s4Intro', 'LegalPage.s4Item1'],
        25,
      ),
    );
  }
}

describe('BaseTranslationProvider', () => {
  it('includes provider SDK details in AI provider errors', () => {
    const provider = new TestProvider();

    expect(() =>
      provider.fail({
        status: 404,
        code: 'model_not_found',
        error: {
          message: 'No endpoints found for deepseek/deepseek-chat-v32',
          type: 'invalid_request_error',
        },
        response: {
          statusText: 'Not Found',
          data: { detail: 'Model slug is invalid' },
        },
      }),
    ).toThrow(AIProviderError);

    try {
      provider.fail({
        status: 404,
        code: 'model_not_found',
        error: {
          message: 'No endpoints found for deepseek/deepseek-chat-v32',
          type: 'invalid_request_error',
        },
        response: {
          statusText: 'Not Found',
          data: { detail: 'Model slug is invalid' },
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderError);
      expect((error as Error).message).toContain('Provider details:');
      expect((error as Error).message).toContain('HTTP status: 404');
      expect((error as Error).message).toContain('Code: model_not_found');
      expect((error as Error).message).toContain(
        'Provider message: No endpoints found for deepseek/deepseek-chat-v32',
      );
      expect((error as Error).message).toContain(
        'Response body: {"detail":"Model slug is invalid"}',
      );
    }
  });

  it('explains incomplete provider responses with actionable fixes', () => {
    const provider = new TestProvider();

    expect(() => provider.failIncomplete()).toThrow(AIProviderError);

    try {
      provider.failIncomplete();
    } catch (error) {
      expect((error as Error).message).toContain(
        'Translation response was incomplete: 3/25 keys were missing.',
      );
      expect((error as Error).message).toContain('reduce ai_translation.batch_size');
      expect((error as Error).message).toContain('enable ai_translation.values_only');
      expect((error as Error).message).toContain('resume from the saved checkpoint');
    }
  });
});
