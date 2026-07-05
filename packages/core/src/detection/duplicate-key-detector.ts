import { readFileSync } from 'node:fs';
import { visit } from 'jsonc-parser';
import type { TranslationFile, DuplicateKeyResult } from '@ndnci/translify-shared';

/**
 * Detects keys declared more than once in the same raw JSON file.
 *
 * `JSON.parse` silently keeps only the last occurrence of a duplicate key,
 * so this is invisible once the file is parsed — it has to be caught by
 * scanning the raw text instead.
 */
export function detectDuplicateKeys(translationFiles: TranslationFile[]): DuplicateKeyResult[] {
  const results: DuplicateKeyResult[] = [];

  for (const file of translationFiles) {
    const rawText = readFileSync(file.path, 'utf8');
    const occurrencesByPath = new Map<string, { line: number; column: number }[]>();

    visit(rawText, {
      onObjectProperty(property, _offset, _length, startLine, startCharacter, pathSupplier) {
        const dottedPath = [...pathSupplier(), property].join('.');
        const list = occurrencesByPath.get(dottedPath) ?? [];
        list.push({ line: startLine + 1, column: startCharacter });
        occurrencesByPath.set(dottedPath, list);
      },
    });

    for (const [key, occurrences] of occurrencesByPath) {
      if (occurrences.length > 1) {
        results.push({ key, file: file.path, occurrences });
      }
    }
  }

  return results;
}
