import {
  type TranslationFile,
  flattenTranslations,
  unflattenTranslations,
} from '@ndnci/translify-shared';
import type { BaseTranslationProvider } from './providers/base-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import type { TranslifyConfig } from '@ndnci/translify-config';
import { writeFileSync } from 'node:fs';

export interface TranslateOptions {
  /** Translation files to translate */
  files: TranslationFile[];
  /** Reference language (source of truth) */
  defaultLanguage: string;
  /** Target languages to translate into (empty = translate all non-default languages) */
  targetLanguages?: string[];
  /** Only translate keys with empty/missing values */
  onlyMissing?: boolean;
  /** Number of keys per API call */
  batchSize?: number;
  dryRun?: boolean;
}

export interface TranslateFileResult {
  language: string;
  file: string;
  translatedKeys: number;
  skippedKeys: number;
}

/**
 * Creates the configured AI provider from the Translify config.
 */
export function createProvider(config: TranslifyConfig['ai_translation']): BaseTranslationProvider {
  if (config.provider === 'openai') {
    return new OpenAIProvider({
      apiKey: config.openai_api_key!,
      model: config.model,
      temperature: config.temperature,
    });
  }

  // Exhaustive check — TypeScript will catch unhandled providers at compile time
  const _never: never = config.provider;
  throw new Error(`Unknown AI provider: ${String(_never)}`);
}

/**
 * Translates missing keys in all target language files using the configured
 * AI provider, batching API calls to stay within token limits.
 */
export async function translateMissingKeys(
  provider: BaseTranslationProvider,
  options: TranslateOptions,
): Promise<TranslateFileResult[]> {
  const results: TranslateFileResult[] = [];

  const referenceFile = options.files.find((f) => f.language === options.defaultLanguage);

  if (!referenceFile) {
    throw new Error(`Reference language file not found for language: "${options.defaultLanguage}"`);
  }

  const referenceFlat = flattenTranslations(referenceFile.data);

  const targets = options.files.filter((f) => {
    if (f.language === options.defaultLanguage) return false;
    if (options.targetLanguages?.length) {
      return options.targetLanguages.includes(f.language);
    }
    return true;
  });

  for (const file of targets) {
    const fileFlat = flattenTranslations(file.data);

    // Determine which keys need translation
    const toTranslate: Record<string, string> = {};

    for (const [key, sourceValue] of Object.entries(referenceFlat)) {
      const existing = fileFlat[key];
      if (options.onlyMissing !== false && existing && existing.trim()) {
        continue; // Already translated
      }
      toTranslate[key] = sourceValue;
    }

    const batchSize = options.batchSize ?? 50;
    const keys = Object.keys(toTranslate);
    let translatedCount = 0;

    for (let i = 0; i < keys.length; i += batchSize) {
      const batchKeys = keys.slice(i, i + batchSize);
      const batchEntries = Object.fromEntries(batchKeys.map((k) => [k, toTranslate[k]!]));

      const response = await provider.translate({
        entries: batchEntries,
        sourceLanguage: options.defaultLanguage,
        targetLanguage: file.language,
      });

      Object.assign(fileFlat, response.translations);
      translatedCount += batchKeys.length;
    }

    if (!options.dryRun && translatedCount > 0) {
      const updated = unflattenTranslations(fileFlat);
      writeFileSync(file.path, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    }

    results.push({
      language: file.language,
      file: file.path,
      translatedKeys: translatedCount,
      skippedKeys: Object.keys(referenceFlat).length - translatedCount,
    });
  }

  return results;
}
