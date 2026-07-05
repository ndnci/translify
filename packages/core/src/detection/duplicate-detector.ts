import {
  type TranslationFile,
  type TranslationRecord,
  type DuplicateValueResult,
  deepMerge,
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
  const filesByLanguage = new Map<string, TranslationFile[]>();

  for (const file of translationFiles) {
    const list = filesByLanguage.get(file.language) ?? [];
    list.push(file);
    filesByLanguage.set(file.language, list);
  }

  for (const [language, files] of filesByLanguage) {
    const merged = files.reduce<TranslationRecord>((acc, file) => deepMerge(acc, file.data), {});
    const flat = flattenTranslations(merged);

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
          language,
          file: files[0]!.path,
        });
      }
    }
  }

  return results;
}
