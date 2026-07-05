import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { modify, applyEdits, type FormattingOptions } from 'jsonc-parser';
import {
  type TranslationFile,
  type TranslationRecord,
  type SyncResult,
  TranslationFileError,
  deepMerge,
  flattenTranslations,
  extractLanguageFromPath,
  unflattenTranslations,
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

/**
 * Adds keys to an existing translation file surgically, or creates a new file
 * when split-file routing points to a file that does not exist yet.
 */
export function addTranslationKeys(filePath: string, additions: Record<string, string>): void {
  if (Object.keys(additions).length === 0) return;

  if (!existsSync(filePath)) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeTranslationFile(filePath, unflattenTranslations(additions));
    return;
  }

  const rawText = readFileSync(filePath, 'utf8');
  writeTranslationFileSurgical(filePath, rawText, additions);
}

/**
 * Removes flat dot-notation keys from a JSON translation file while preserving
 * unrelated formatting as much as jsonc-parser allows.
 */
export function removeTranslationKeys(filePath: string, keys: string[]): void {
  if (keys.length === 0 || !existsSync(filePath)) return;

  let text = readFileSync(filePath, 'utf8');
  const formattingOptions = detectFormattingOptions(text);

  for (const key of keys) {
    const edits = modify(text, key.split('.'), undefined, {
      formattingOptions,
      getInsertionIndex: () => 0,
    });
    text = applyEdits(text, edits);
  }

  if (!text.endsWith('\n')) text += formattingOptions.eol;
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
  /**
   * Optional callback used by split-file projects to route a missing key to a
   * specific translation file.
   */
  resolveTargetFile?: (key: string, language: string, files: TranslationFile[]) => string;
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
  const resultsByFile = new Map<string, SyncResult>();
  const filesByLanguage = groupFilesByLanguage(options.files);

  const defaultFile = options.files.find((f) => f.language === options.defaultLanguage);
  const defaultFlat = defaultFile
    ? flattenTranslations(mergeTranslationFiles(filesByLanguage.get(options.defaultLanguage) ?? []))
    : {};

  for (const [language, files] of filesByLanguage) {
    const flat = flattenTranslations(mergeTranslationFiles(files));
    const added: string[] = [];
    const unchanged: string[] = [];
    const additionsByFile = new Map<string, Record<string, string>>();

    for (const key of options.extractedKeys) {
      if (key in flat) {
        unchanged.push(key);
      } else {
        // Use the default language value if available; otherwise empty string
        const value =
          !options.useEmptyForMissing && language !== options.defaultLanguage
            ? (defaultFlat[key] ?? '')
            : '';
        const targetFile =
          options.resolveTargetFile?.(key, language, files) ?? resolveDefaultTargetFile(key, files);
        const additions = additionsByFile.get(targetFile) ?? {};
        additions[key] = value;
        additionsByFile.set(targetFile, additions);
        added.push(key);
      }
    }

    for (const [filePath, additions] of additionsByFile) {
      if (!options.dryRun) {
        addTranslationKeys(filePath, additions);
      }

      const result = resultsByFile.get(filePath) ?? {
        language,
        file: filePath,
        added: [],
        removed: [],
        unchanged: 0,
      };
      result.added.push(...Object.keys(additions));
      resultsByFile.set(filePath, result);
    }

    for (const file of files) {
      const result = resultsByFile.get(file.path) ?? {
        language,
        file: file.path,
        added: [],
        removed: [],
        unchanged: 0,
      };
      result.unchanged += unchanged.length;
      resultsByFile.set(file.path, result);
    }
  }

  return [...resultsByFile.values()].sort((a, b) => a.file.localeCompare(b.file));
}

function groupFilesByLanguage(files: TranslationFile[]): Map<string, TranslationFile[]> {
  const byLanguage = new Map<string, TranslationFile[]>();
  for (const file of files) {
    const list = byLanguage.get(file.language) ?? [];
    list.push(file);
    byLanguage.set(file.language, list);
  }
  return byLanguage;
}

function mergeTranslationFiles(files: TranslationFile[]): TranslationRecord {
  return files.reduce<TranslationRecord>((merged, file) => deepMerge(merged, file.data), {});
}

function resolveDefaultTargetFile(key: string, files: TranslationFile[]): string {
  const root = key.split('.')[0] ?? key;
  const existing = files.find((file) => Object.hasOwn(file.data, root));
  return existing?.path ?? files[0]?.path ?? '';
}
