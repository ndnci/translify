import type { TranslifyConfigInput } from '@ndnci/translify-shared';

/**
 * Type-safe helper for defining a Translify config.
 *
 * Provides full IntelliSense in editors without requiring you to import types
 * directly.
 *
 * @example
 * ```ts
 * // translify.config.ts
 * import { defineConfig } from '@ndnci/translify/config';
 *
 * export default defineConfig({
 *   translations: {
 *     default_language: 'en',
 *     files: ['messages/*.json'],
 *   },
 * });
 * ```
 */
export function defineConfig(config: TranslifyConfigInput): TranslifyConfigInput {
  return config;
}
