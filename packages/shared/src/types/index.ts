export * from './config.js';

// ─── Extraction ────────────────────────────────────────────────────────────────

export interface ExtractionEntry {
  /** The translation key found in source code, e.g. "home.title" */
  key: string;
  /** Absolute path to the source file */
  file: string;
  /** 1-indexed line number where the key was found */
  line: number;
  /** 0-indexed column number */
  column: number;
  /** How the key was found */
  type: 'translation-call' | 'hardcoded-text';
  /** The function call that was matched, e.g. "t" or "i18n.t" */
  callExpression?: string;
}

export interface ExtractionResult {
  entries: ExtractionEntry[];
  /** Absolute path to the scanned file */
  file: string;
  /** Total number of entries found */
  count: number;
}

// ─── Translation Files ─────────────────────────────────────────────────────────

export type TranslationValue = string | TranslationRecord;

export interface TranslationRecord {
  [key: string]: TranslationValue;
}

export interface TranslationFile {
  /** BCP 47 language tag, e.g. "en", "fr", "pt-BR" */
  language: string;
  /** Absolute path to the JSON file */
  path: string;
  /** Parsed JSON content */
  data: TranslationRecord;
}

// ─── Detection Results ─────────────────────────────────────────────────────────

export interface UnusedKeyResult {
  /** Dot-notation key, e.g. "home.title" */
  key: string;
  language: string;
  file: string;
  value: string;
}

export interface MissingKeyResult {
  key: string;
  /** Language that is missing the key */
  language: string;
  /** Translation file path */
  file: string;
  /** Source file where the key is used */
  sourceFile: string;
  sourceLine: number;
}

export interface DuplicateValueResult {
  /** The duplicated string value */
  value: string;
  /** All keys that share this value */
  keys: string[];
  language: string;
  file: string;
}

export interface DuplicateKeyResult {
  /** Dot-notation key that is declared more than once in the same raw JSON file */
  key: string;
  /** Translation file path where the duplication was found */
  file: string;
  /** Every location the key was declared at (JSON.parse silently keeps only the last one) */
  occurrences: { line: number; column: number }[];
}

export interface LocaleInconsistencyResult {
  /** Dot-notation key present in the default language but not consistently mirrored */
  key: string;
  /** Non-default languages missing this key */
  missingIn: string[];
  /** Languages (including default) where this key is present */
  presentIn: string[];
}

// ─── Sync ──────────────────────────────────────────────────────────────────────

export interface SyncResult {
  language: string;
  file: string;
  /** Keys that were added to this file */
  added: string[];
  /** Keys that were removed from this file */
  removed: string[];
  /** Number of keys unchanged */
  unchanged: number;
}

// ─── Optimize ─────────────────────────────────────────────────────────────────

export interface OptimizeResult {
  file: string;
  language: string;
  /** Number of keys sorted */
  sortedKeys: number;
  /** Number of empty-value entries removed or flagged */
  emptyKeysFound: number;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditResult {
  unusedKeys: UnusedKeyResult[];
  missingKeys: MissingKeyResult[];
  duplicateValues: DuplicateValueResult[];
  duplicateKeys: DuplicateKeyResult[];
  localeInconsistencies: LocaleInconsistencyResult[];
  totalFiles: number;
  totalKeys: number;
  totalUsedKeys: number;
  /** ISO timestamp */
  timestamp: string;
}

// ─── Logging ──────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  success(message: string, ...args: unknown[]): void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface TranslifyContext {
  /** Resolved working directory */
  cwd: string;
  /** Whether to write files or only preview changes */
  dryRun: boolean;
  /** Enable verbose output */
  verbose: boolean;
  logger: Logger;
}
