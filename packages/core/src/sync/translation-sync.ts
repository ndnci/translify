import { readFileSync, writeFileSync } from 'node:fs';
import { modify, applyEdits, type FormattingOptions } from 'jsonc-parser';
import {
  type TranslationFile,
  type TranslationRecord,
  type SyncResult,
  TranslationFileError,
  flattenTranslations,
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
 *
 * Full re-serialization — use for commands that intentionally reformat the
 * whole file (e.g. `optimize`). For adding a handful of missing keys, prefer
 * `writeTranslationFileSurgical` so unrelated formatting is left untouched.
 */
export function writeTranslationFile(filePath: string, data: TranslationRecord): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Detects the indentation style and line ending already used by a JSON file
 * so newly inserted keys match the surrounding formatting.
 */
function detectFormattingOptions(rawText: string): FormattingOptions {
  const eol = rawText.includes('\r\n') ? '\r\n' : '\n';
  const indentMatch = rawText.match(/\n([ \t]+)\S/);
  const indent = indentMatch?.[1] ?? '  ';
  const insertSpaces = !indent.startsWith('\t');
  const tabSize = insertSpaces ? indent.length : 1;
  return { eol, insertSpaces, tabSize };
}

/**
 * Adds keys to a JSON translation file by surgically editing its raw text
 * (via jsonc-parser) instead of re-serializing the whole object, so every
 * untouched line — indentation, key order, spacing — is preserved byte for
 * byte. Only the newly inserted keys show up in a diff.
 */
export function writeTranslationFileSurgical(
  filePath: string,
  rawText: string,
  additions: Record<string, string>,
): void {
  const formattingOptions = detectFormattingOptions(rawText);

  let text = rawText;
  for (const [flatKey, value] of Object.entries(additions)) {
    const path = flatKey.split('.');
    const edits = modify(text, path, value, { formattingOptions });
    text = applyEdits(text, edits);
  }

  if (!text.endsWith('\n')) {
    text += formattingOptions.eol;
  }

  writeFileSync(filePath, text, 'utf8');
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
      const additions: Record<string, string> = {};
      for (const key of added) additions[key] = flat[key]!;

      const rawText = readFileSync(file.path, 'utf8');
      writeTranslationFileSurgical(file.path, rawText, additions);
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
