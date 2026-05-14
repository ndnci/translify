import {
  type TranslationFile,
  type OptimizeResult,
  flattenTranslations,
  sortTranslationKeys,
} from '@ndnci/translify-shared';
import { writeTranslationFile } from '../sync/translation-sync.js';

export interface OptimizeOptions {
  files: TranslationFile[];
  /** Sort all keys alphabetically (recursively) */
  sortKeys?: boolean;
  /** Report (but don't remove) keys with empty string values */
  reportEmpty?: boolean;
  dryRun?: boolean;
}

/**
 * Optimizes translation files:
 * - Sorts keys alphabetically at every nesting level
 * - Reports empty-value entries
 *
 * This is non-destructive by default (does not remove keys).
 */
export function optimizeTranslationFiles(options: OptimizeOptions): OptimizeResult[] {
  const results: OptimizeResult[] = [];

  for (const file of options.files) {
    const flat = flattenTranslations(file.data);

    const emptyKeys = Object.entries(flat)
      .filter(([, v]) => !v.trim())
      .map(([k]) => k);

    let optimized = file.data;

    if (options.sortKeys !== false) {
      optimized = sortTranslationKeys(file.data);
    }

    if (!options.dryRun) {
      writeTranslationFile(file.path, optimized);
    }

    results.push({
      file: file.path,
      language: file.language,
      sortedKeys: Object.keys(flat).length,
      emptyKeysFound: emptyKeys.length,
    });
  }

  return results;
}
