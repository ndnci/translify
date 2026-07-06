import {
  type TranslationFile,
  type TranslationRecord,
  flattenTranslations,
  unflattenTranslations,
  deepMerge,
} from '@ndnci/translify-shared';
import {
  type BaseTranslationProvider,
  type TranslationUsage,
  mergeTranslationUsage,
} from './providers/base-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { OpenRouterProvider } from './providers/openrouter-provider.js';
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
  /** Send only values to the provider and remap by order */
  valuesOnly?: boolean;
  /** Run a verification/correction pass after translation */
  verify?: boolean;
  /** Optional verification model override */
  verifyModel?: string;
  dryRun?: boolean;
}

export interface TranslateFileResult {
  language: string;
  file: string;
  translatedKeys: number;
  skippedKeys: number;
  usage?: TranslationUsage;
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

  if (config.provider === 'openrouter') {
    return new OpenRouterProvider({
      apiKey: config.openrouter_api_key!,
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

  const filesByLanguage = groupFilesByLanguage(options.files);
  const referenceFiles = filesByLanguage.get(options.defaultLanguage) ?? [];

  if (referenceFiles.length === 0) {
    throw new Error(`Reference language file not found for language: "${options.defaultLanguage}"`);
  }

  const referenceBySignature = new Map(
    referenceFiles.map((file) => [translationFileSignature(file), file]),
  );
  const mergedReferenceFlat = flattenTranslations(mergeTranslationFiles(referenceFiles));

  const targets = options.files.filter((f) => {
    if (f.language === options.defaultLanguage) return false;
    if (options.targetLanguages?.length) {
      return options.targetLanguages.includes(f.language);
    }
    return true;
  });

  for (const file of targets) {
    const fileFlat = flattenTranslations(file.data);
    const referenceFile = referenceBySignature.get(translationFileSignature(file));
    const referenceFlat = referenceFile
      ? flattenTranslations(referenceFile.data)
      : mergedReferenceFlat;

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
    let usage: TranslationUsage | undefined;

    for (let i = 0; i < keys.length; i += batchSize) {
      const batchKeys = keys.slice(i, i + batchSize);
      const batchEntries = Object.fromEntries(batchKeys.map((k) => [k, toTranslate[k]!]));

      const response = await provider.translate({
        entries: batchEntries,
        sourceLanguage: options.defaultLanguage,
        targetLanguage: file.language,
        ...(options.valuesOnly !== undefined && { valuesOnly: options.valuesOnly }),
        ...(options.verify !== undefined && { verify: options.verify }),
        ...(options.verifyModel !== undefined && { verifyModel: options.verifyModel }),
      });

      Object.assign(fileFlat, response.translations);
      translatedCount += batchKeys.length;
      usage = mergeTranslationUsage(usage, response.usage);
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
      ...(usage && { usage }),
    });
  }

  return results;
}

function groupFilesByLanguage(files: TranslationFile[]): Map<string, TranslationFile[]> {
  const byLanguage = new Map<string, TranslationFile[]>();
  for (const file of files) {
    const list = byLanguage.get(file.language) ?? [];
    list.push(file);
    byLanguage.set(file.language, list);
  }
  return byLanguage;
}

function mergeTranslationFiles(files: TranslationFile[]): TranslationRecord {
  return files.reduce<TranslationRecord>((merged, file) => deepMerge(merged, file.data), {});
}

function translationFileSignature(file: TranslationFile): string {
  const normalized = file.path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const basename = parts.at(-1) ?? normalized;
  const stem = basename.replace(/\.json$/, '');

  if (stem === file.language) return '__single__';

  for (let i = parts.length - 2; i >= 0; i--) {
    if (parts[i] === file.language) {
      return parts.slice(i + 1).join('/');
    }
  }

  return basename;
}
