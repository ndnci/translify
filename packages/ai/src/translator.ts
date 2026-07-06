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
  /** Called as files and batches move through translation */
  onProgress?: (event: TranslateProgressEvent) => void;
}

export interface TranslateFileResult {
  language: string;
  file: string;
  translatedKeys: number;
  skippedKeys: number;
  usage?: TranslationUsage;
}

export interface TranslateProgressFile {
  language: string;
  file: string;
  translatedKeys: number;
  totalKeys: number;
}

export type TranslateProgressEvent =
  | { type: 'start'; files: TranslateProgressFile[] }
  | { type: 'file-start'; file: TranslateProgressFile }
  | { type: 'file-progress'; file: TranslateProgressFile }
  | { type: 'file-complete'; file: TranslateProgressFile }
  | { type: 'complete'; files: TranslateProgressFile[] };

interface TranslateFilePlan {
  language: string;
  file: string;
  path: string;
  fileFlat: Record<string, string>;
  referenceFlat: Record<string, string>;
  keys: string[];
  toTranslate: Record<string, string>;
  translatedKeys: number;
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

  const plans = targets.map((file): TranslateFilePlan => {
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

    return {
      language: file.language,
      file: file.path,
      path: file.path,
      fileFlat,
      referenceFlat,
      keys: Object.keys(toTranslate),
      toTranslate,
      translatedKeys: 0,
    };
  });

  emitProgress(options, {
    type: 'start',
    files: plans.map(progressFileFromPlan),
  });

  for (const plan of plans) {
    const batchSize = options.batchSize ?? 50;
    const keys = plan.keys;

    emitProgress(options, { type: 'file-start', file: progressFileFromPlan(plan) });

    for (let i = 0; i < keys.length; i += batchSize) {
      const batchKeys = keys.slice(i, i + batchSize);
      const batchEntries = Object.fromEntries(batchKeys.map((k) => [k, plan.toTranslate[k]!]));

      const response = await provider.translate({
        entries: batchEntries,
        sourceLanguage: options.defaultLanguage,
        targetLanguage: plan.language,
        ...(options.valuesOnly !== undefined && { valuesOnly: options.valuesOnly }),
        ...(options.verify !== undefined && { verify: options.verify }),
        ...(options.verifyModel !== undefined && { verifyModel: options.verifyModel }),
      });

      Object.assign(plan.fileFlat, response.translations);
      plan.translatedKeys += batchKeys.length;
      const usage = mergeTranslationUsage(plan.usage, response.usage);
      if (usage) {
        plan.usage = usage;
      }
      emitProgress(options, { type: 'file-progress', file: progressFileFromPlan(plan) });
    }

    if (!options.dryRun && plan.translatedKeys > 0) {
      const updated = unflattenTranslations(plan.fileFlat);
      writeFileSync(plan.path, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    }

    emitProgress(options, { type: 'file-complete', file: progressFileFromPlan(plan) });

    results.push({
      language: plan.language,
      file: plan.path,
      translatedKeys: plan.translatedKeys,
      skippedKeys: Object.keys(plan.referenceFlat).length - plan.translatedKeys,
      ...(plan.usage && { usage: plan.usage }),
    });
  }

  emitProgress(options, {
    type: 'complete',
    files: plans.map(progressFileFromPlan),
  });

  return results;
}

function emitProgress(options: TranslateOptions, event: TranslateProgressEvent): void {
  options.onProgress?.(event);
}

function progressFileFromPlan(plan: TranslateFilePlan): TranslateProgressFile {
  return {
    language: plan.language,
    file: plan.file,
    translatedKeys: plan.translatedKeys,
    totalKeys: plan.keys.length,
  };
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
