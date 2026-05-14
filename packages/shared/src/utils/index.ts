import { type TranslationRecord, type TranslationValue } from '../types/index.js';

/**
 * Flattens a nested translation object into dot-notation keys.
 *
 * Example:
 *   { home: { title: "Hello" } } → { "home.title": "Hello" }
 */
export function flattenTranslations(obj: TranslationRecord, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const dotKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenTranslations(value as TranslationRecord, dotKey));
    } else {
      result[dotKey] = String(value ?? '');
    }
  }

  return result;
}

/**
 * Unflattens dot-notation keys back into a nested object.
 *
 * Example:
 *   { "home.title": "Hello" } → { home: { title: "Hello" } }
 */
export function unflattenTranslations(flat: Record<string, string>): TranslationRecord {
  const result: TranslationRecord = {};

  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as TranslationRecord;
    }

    const lastPart = parts[parts.length - 1]!;
    current[lastPart] = value;
  }

  return result;
}

/**
 * Deeply merges source into target. Does not mutate target — returns a new object.
 */
export function deepMerge<T extends TranslationRecord>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal !== undefined &&
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null
    ) {
      result[key] = deepMerge(
        targetVal as TranslationRecord,
        sourceVal as TranslationRecord,
      ) as T[keyof T];
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T];
    }
  }

  return result;
}

/**
 * Sorts the keys of a translation object alphabetically at each level.
 */
export function sortTranslationKeys(obj: TranslationRecord): TranslationRecord {
  const result: TranslationRecord = {};
  const sortedKeys = Object.keys(obj).sort();

  for (const key of sortedKeys) {
    const value: TranslationValue | undefined = obj[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sortTranslationKeys(value as TranslationRecord);
    } else {
      result[key] = value ?? '';
    }
  }

  return result;
}

/**
 * Checks whether a string matches any of the provided regex patterns.
 */
export function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern).test(value);
    } catch {
      return false;
    }
  });
}

/**
 * Extracts the language code from a translation file path.
 *
 * Example: "messages/en.json" → "en"
 */
export function extractLanguageFromPath(filePath: string): string {
  const basename = filePath.split('/').pop() ?? filePath;
  return basename.replace(/\.json$/, '');
}

/**
 * Formats a number with a leading + or shows it as-is for display.
 */
export function formatCount(n: number, unit: string): string {
  return `${n} ${unit}${n !== 1 ? 's' : ''}`;
}

/**
 * Returns the relative path from cwd for display purposes.
 */
export function relativePath(absolutePath: string, cwd: string): string {
  if (absolutePath.startsWith(cwd)) {
    return absolutePath.slice(cwd.length).replace(/^\//, '');
  }
  return absolutePath;
}
