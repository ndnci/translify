import {
  type TranslationFile,
  type UnusedKeyResult,
  flattenTranslations,
} from '@ndnci/translify-shared';

/**
 * Detects translation keys that are defined in translation files
 * but never referenced in any source file.
 *
 * These are safe candidates for removal after manual review.
 */
export function detectUnusedKeys(
  translationFiles: TranslationFile[],
  usedKeys: Set<string>,
): UnusedKeyResult[] {
  const results: UnusedKeyResult[] = [];

  for (const file of translationFiles) {
    const flat = flattenTranslations(file.data);

    for (const [key, value] of Object.entries(flat)) {
      if (!usedKeys.has(key)) {
        results.push({
          key,
          language: file.language,
          file: file.path,
          value,
        });
      }
    }
  }

  return results;
}
