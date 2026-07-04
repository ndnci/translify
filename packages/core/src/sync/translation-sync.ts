import { readFileSync, writeFileSync } from 'node:fs';
import {
  type TranslationFile,
  type TranslationRecord,
  type SyncResult,
  TranslationFileError,
  flattenTranslations,
  unflattenTranslations,
  extractLanguageFromPath,
} from '@ndnci/translify-shared';

// ─── I/O ──────────────────────────────────────────────────────────────────────

/**
 * Loads a JSON translation file from disk.
 * @throws TranslationFileError on read or parse failure
 */
export function loadTranslationFile(filePath: string): TranslationFile {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (cause) {
    throw new TranslationFileError(filePath, 'File not found or not readable', cause);
  }

  let data: TranslationRecord;
  try {
    data = JSON.parse(raw) as TranslationRecord;
  } catch (cause) {
    throw new TranslationFileError(filePath, 'Invalid JSON', cause);
  }

  return {
    language: extractLanguageFromPath(filePath),
    path: filePath,
    data,
  };
}

/**
 * Writes a translation file back to disk with consistent 2-space indentation.
 */
export function writeTranslationFile(filePath: string, data: TranslationRecord): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncOptions {
  /** Flat set of keys extracted from source code */
  extractedKeys: Set<string>;
  /** Translation files to synchronize */
  files: TranslationFile[];
  /** Language tag of the reference/source language */
  defaultLanguage: string;
  /**
   * When true, adds empty-string placeholders for missing keys.
   * When false, copies the value from the default-language file.
   */
  useEmptyForMissing?: boolean;
  dryRun?: boolean;
}

/**
 * Synchronizes all translation files against the set of extracted keys.
 *
 * For each file:
 * - Adds missing keys (either empty or copied from the default language)
 * - Does NOT remove unused keys (use `unusedDetector` for that)
 */
export function syncTranslationFiles(options: SyncOptions): SyncResult[] {
  const results: SyncResult[] = [];

  const defaultFile = options.files.find((f) => f.language === options.defaultLanguage);
  const defaultFlat = defaultFile ? flattenTranslations(defaultFile.data) : {};

  for (const file of options.files) {
    const flat = flattenTranslations(file.data);
    const added: string[] = [];
    const unchanged: string[] = [];

    for (const key of options.extractedKeys) {
      if (key in flat) {
        unchanged.push(key);
      } else {
        // Use the default language value if available; otherwise empty string
        const value =
          !options.useEmptyForMissing && file.language !== options.defaultLanguage
            ? (defaultFlat[key] ?? '')
            : '';
        flat[key] = value;
        added.push(key);
      }
    }

    if (added.length > 0 && !options.dryRun) {
      const updated = unflattenTranslations(flat);
      writeTranslationFile(file.path, updated);
    }

    results.push({
      language: file.language,
      file: file.path,
      added,
      removed: [],
      unchanged: unchanged.length,
    });
  }

  return results;
}
