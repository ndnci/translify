import {
  type TranslationFile,
  type DuplicateValueResult,
  flattenTranslations,
} from '@ndnci/translify-shared';

/**
 * Detects translation entries where multiple keys share the same translated
 * value within a single language file.
 *
 * This often indicates either redundant entries or a missing consolidation.
 */
export function detectDuplicateValues(translationFiles: TranslationFile[]): DuplicateValueResult[] {
  const results: DuplicateValueResult[] = [];

  for (const file of translationFiles) {
    const flat = flattenTranslations(file.data);

    // Group keys by their value
    const valueToKeys = new Map<string, string[]>();

    for (const [key, value] of Object.entries(flat)) {
      if (!value.trim()) continue; // Skip empty values

      const existing = valueToKeys.get(value);
      if (existing) {
        existing.push(key);
      } else {
        valueToKeys.set(value, [key]);
      }
    }

    for (const [value, keys] of valueToKeys.entries()) {
      if (keys.length > 1) {
        results.push({
          value,
          keys,
          language: file.language,
          file: file.path,
        });
      }
    }
  }

  return results;
}
