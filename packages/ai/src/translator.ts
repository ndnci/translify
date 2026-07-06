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
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

export interface TranslateOptions {
  /** Translation files to translate */
  files: TranslationFile[];
  /** Reference language (source of truth) */
  defaultLanguage: string;
  /** Target languages to translate into (empty = translate all non-default languages) */
  targetLanguages?: string[];
  /** Target translation files to translate (empty = all target files) */
  targetFiles?: string[];
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
  /** Persist completed batches so failed/interrupted runs can resume */
  checkpoint?: TranslateCheckpointOptions;
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

export interface TranslateCheckpointOptions {
  path: string;
  /** Stable identifier for this command/config/file set */
  signature: string;
  /** Reuse saved translated batches when true */
  resume?: boolean;
}

interface TranslateCheckpoint {
  version: 1;
  signature: string;
  createdAt: string;
  updatedAt: string;
  files: Record<string, TranslateCheckpointFile>;
}

interface TranslateCheckpointFile {
  language: string;
  file: string;
  totalKeys: number;
  translations: Record<string, string>;
  completed: boolean;
}

interface TranslateFilePlan {
  language: string;
  file: string;
  path: string;
  fileFlat: Record<string, string>;
  referenceFlat: Record<string, string>;
  keys: string[];
  toTranslate: Record<string, string>;
  completedKeys: Set<string>;
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
      if (!options.targetLanguages.includes(f.language)) return false;
    }
    if (options.targetFiles?.length) {
      return options.targetFiles.some((file) => samePath(file, f.path));
    }
    return true;
  });

  if (options.targetFiles?.length && targets.length === 0) {
    throw new Error(
      'No target translation files matched --file. Make sure the selected file exists in translations.files, is not the default-language file, and matches --locale if provided.',
    );
  }

  const checkpoint = loadCheckpoint(options);

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

    const saved = checkpoint?.files[file.path];
    const completedKeys = new Set(
      saved && saved.totalKeys === Object.keys(toTranslate).length
        ? Object.keys(saved.translations).filter((key) => key in toTranslate)
        : [],
    );

    if (saved) {
      Object.assign(fileFlat, pickTranslations(saved.translations, completedKeys));
    }

    return {
      language: file.language,
      file: file.path,
      path: file.path,
      fileFlat,
      referenceFlat,
      keys: Object.keys(toTranslate),
      toTranslate,
      completedKeys,
    };
  });

  let activeCheckpoint = syncCheckpointWithPlans(checkpoint ?? createCheckpoint(options), plans);
  saveCheckpoint(options, activeCheckpoint);

  emitProgress(options, {
    type: 'start',
    files: plans.map(progressFileFromPlan),
  });

  for (const plan of plans) {
    const batchSize = options.batchSize ?? 50;
    const keys = plan.keys.filter((key) => !plan.completedKeys.has(key));

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
      for (const key of batchKeys) {
        plan.completedKeys.add(key);
      }
      const usage = mergeTranslationUsage(plan.usage, response.usage);
      if (usage) {
        plan.usage = usage;
      }
      activeCheckpoint = updateCheckpointFile(activeCheckpoint, plan, false);
      saveCheckpoint(options, activeCheckpoint);
      emitProgress(options, { type: 'file-progress', file: progressFileFromPlan(plan) });
    }

    if (!options.dryRun && plan.completedKeys.size > 0) {
      const updated = unflattenTranslations(plan.fileFlat);
      writeFileSync(plan.path, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    }

    activeCheckpoint = updateCheckpointFile(activeCheckpoint, plan, true);
    saveCheckpoint(options, activeCheckpoint);
    emitProgress(options, { type: 'file-complete', file: progressFileFromPlan(plan) });

    results.push({
      language: plan.language,
      file: plan.path,
      translatedKeys: plan.completedKeys.size,
      skippedKeys: Object.keys(plan.referenceFlat).length - plan.completedKeys.size,
      ...(plan.usage && { usage: plan.usage }),
    });
  }

  emitProgress(options, {
    type: 'complete',
    files: plans.map(progressFileFromPlan),
  });

  clearCheckpoint(options);

  return results;
}

function emitProgress(options: TranslateOptions, event: TranslateProgressEvent): void {
  options.onProgress?.(event);
}

function progressFileFromPlan(plan: TranslateFilePlan): TranslateProgressFile {
  return {
    language: plan.language,
    file: plan.file,
    translatedKeys: plan.completedKeys.size,
    totalKeys: plan.keys.length,
  };
}

function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, '/') === b.replace(/\\/g, '/');
}

function createCheckpoint(options: TranslateOptions): TranslateCheckpoint | undefined {
  if (!shouldUseCheckpoint(options)) return undefined;

  const now = new Date().toISOString();
  return {
    version: 1,
    signature: options.checkpoint.signature,
    createdAt: now,
    updatedAt: now,
    files: {},
  };
}

function loadCheckpoint(options: TranslateOptions): TranslateCheckpoint | undefined {
  if (!shouldUseCheckpoint(options) || !options.checkpoint.resume) return undefined;
  if (!existsSync(options.checkpoint.path)) return undefined;

  try {
    const parsed = JSON.parse(readFileSync(options.checkpoint.path, 'utf8')) as TranslateCheckpoint;
    if (parsed.version !== 1 || parsed.signature !== options.checkpoint.signature) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function saveCheckpoint(
  options: TranslateOptions,
  checkpoint: TranslateCheckpoint | undefined,
): void {
  if (!shouldUseCheckpoint(options) || !checkpoint) return;

  mkdirSync(dirname(options.checkpoint.path), { recursive: true });
  const updated: TranslateCheckpoint = {
    ...checkpoint,
    updatedAt: new Date().toISOString(),
  };
  const tmpPath = `${options.checkpoint.path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  renameSync(tmpPath, options.checkpoint.path);
}

function syncCheckpointWithPlans(
  checkpoint: TranslateCheckpoint | undefined,
  plans: TranslateFilePlan[],
): TranslateCheckpoint | undefined {
  if (!checkpoint) return undefined;

  return {
    ...checkpoint,
    files: Object.fromEntries(
      plans.map((plan) => {
        const current = checkpoint.files[plan.path];
        const completed =
          current?.completed === true && plan.completedKeys.size === plan.keys.length;
        return [plan.path, checkpointFileFromPlan(plan, completed)];
      }),
    ),
  };
}

function updateCheckpointFile(
  checkpoint: TranslateCheckpoint | undefined,
  plan: TranslateFilePlan,
  completed: boolean,
): TranslateCheckpoint | undefined {
  if (!checkpoint) return undefined;
  return {
    ...checkpoint,
    files: {
      ...checkpoint.files,
      [plan.path]: checkpointFileFromPlan(plan, completed),
    },
  };
}

function checkpointFileFromPlan(
  plan: TranslateFilePlan,
  completed: boolean,
): TranslateCheckpointFile {
  return {
    language: plan.language,
    file: plan.path,
    totalKeys: plan.keys.length,
    translations: pickTranslations(plan.fileFlat, plan.completedKeys),
    completed,
  };
}

function clearCheckpoint(options: TranslateOptions): void {
  if (!shouldUseCheckpoint(options)) return;
  if (existsSync(options.checkpoint.path)) {
    unlinkSync(options.checkpoint.path);
  }
}

function shouldUseCheckpoint(
  options: TranslateOptions,
): options is TranslateOptions & { checkpoint: TranslateCheckpointOptions } {
  return !options.dryRun && options.checkpoint !== undefined;
}

function pickTranslations(
  translations: Record<string, string>,
  keys: Iterable<string>,
): Record<string, string> {
  return Object.fromEntries(
    [...keys]
      .filter((key) => translations[key] !== undefined)
      .map((key) => [key, translations[key]!]),
  );
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
