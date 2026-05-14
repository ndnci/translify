import {
  type TranslationFile,
  type MissingKeyResult,
  type ExtractionEntry,
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

  for (const file of translationFiles) {
    const defined = new Set(Object.keys(flattenTranslations(file.data)));

    for (const entry of extractedEntries) {
      if (!defined.has(entry.key)) {
        results.push({
          key: entry.key,
          language: file.language,
          file: file.path,
          sourceFile: entry.file,
          sourceLine: entry.line,
        });
      }
    }
  }

  // Deduplicate: same key missing from same file (multiple usages in source)
  const seen = new Set<string>();
  return results.filter((r) => {
    const sig = `${r.key}::${r.file}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}
