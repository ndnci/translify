import {
  type TranslationFile,
  type MissingKeyResult,
  type ExtractionEntry,
  deepMerge,
  flattenTranslations,
} from '@ndnci/translify-shared';

/**
 * Detects translation keys that are used in source code but missing
 * from one or more translation files.
 */
export function detectMissingKeys(
  translationFiles: TranslationFile[],
  extractedEntries: ExtractionEntry[],
): MissingKeyResult[] {
  const results: MissingKeyResult[] = [];
  const filesByLanguage = new Map<string, TranslationFile[]>();

  for (const file of translationFiles) {
    const list = filesByLanguage.get(file.language) ?? [];
    list.push(file);
    filesByLanguage.set(file.language, list);
  }

  for (const [language, files] of filesByLanguage) {
    const merged = files.reduce((acc, file) => deepMerge(acc, file.data), {});
    const defined = new Set(Object.keys(flattenTranslations(merged)));
    const fallbackFile = files[0]!;

    for (const entry of extractedEntries) {
      if (!defined.has(entry.key)) {
        results.push({
          key: entry.key,
          language,
          file: fallbackFile.path,
          sourceFile: entry.file,
          sourceLine: entry.line,
        });
      }
    }
  }

  // Deduplicate: same key missing from same file (multiple usages in source)
  const seen = new Set<string>();
  return results.filter((r) => {
    const sig = `${r.key}::${r.language}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}
