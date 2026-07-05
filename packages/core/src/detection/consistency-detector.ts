import {
  type TranslationFile,
  type LocaleInconsistencyResult,
  flattenTranslations,
} from '@ndnci/translify-shared';

/**
 * Detects keys that aren't consistently mirrored across every translation
 * file — present in the default language but missing from one or more
 * other locales (or vice versa).
 *
 * Unlike `detectMissingKeys` (code vs. translation files), this compares
 * translation files against each other.
 */
export function detectLocaleInconsistencies(
  translationFiles: TranslationFile[],
  defaultLanguage: string,
): LocaleInconsistencyResult[] {
  if (translationFiles.length < 2) return [];

  const flatByLanguage = new Map<string, Record<string, string>>();
  for (const file of translationFiles) {
    flatByLanguage.set(file.language, flattenTranslations(file.data));
  }

  const allKeys = new Set<string>();
  for (const flat of flatByLanguage.values()) {
    for (const key of Object.keys(flat)) allKeys.add(key);
  }

  const languages = [...flatByLanguage.keys()];
  const results: LocaleInconsistencyResult[] = [];

  for (const key of allKeys) {
    const presentIn = languages.filter((lang) => key in flatByLanguage.get(lang)!);
    const missingIn = languages.filter((lang) => !presentIn.includes(lang));

    if (missingIn.length === 0) continue;

    // Skip keys that are missing from the default language itself but present
    // elsewhere — that's covered by `detectMissingKeys` against source code,
    // not a cross-locale consistency issue.
    if (!presentIn.includes(defaultLanguage) && languages.includes(defaultLanguage)) continue;

    results.push({ key, missingIn, presentIn });
  }

  return results.sort((a, b) => a.key.localeCompare(b.key));
}
