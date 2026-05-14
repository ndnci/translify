import fg from 'fast-glob';
import { resolve } from 'node:path';
import type { TranslifyConfig } from '@ndnci/translify-shared';

export interface ScanOptions {
  cwd: string;
  include: string[];
  exclude: string[];
}

export interface ScanResult {
  files: string[];
  /** Time taken in milliseconds */
  durationMs: number;
}

/**
 * Scans the filesystem for source files matching the configured patterns.
 *
 * Uses fast-glob with absolute path resolution. Respects include/exclude
 * patterns from the Translify config.
 */
export async function scanSourceFiles(options: ScanOptions): Promise<ScanResult> {
  const start = performance.now();

  const files = await fg(options.include, {
    cwd: options.cwd,
    ignore: options.exclude,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    // Suppress git-ignored files for speed
    dot: false,
  });

  return {
    files: files.sort(),
    durationMs: Math.round(performance.now() - start),
  };
}

/**
 * Scans for translation JSON files matching the configured patterns.
 */
export async function scanTranslationFiles(
  config: Pick<TranslifyConfig, 'translations'>,
  cwd: string,
): Promise<string[]> {
  const files = await fg(config.translations.files, {
    cwd,
    absolute: true,
    onlyFiles: true,
  });

  return files.sort();
}

/**
 * Convenience helper: scan source files using a full TranslifyConfig.
 */
export async function scanFromConfig(
  config: Pick<TranslifyConfig, 'source'>,
  cwd: string,
): Promise<ScanResult> {
  return scanSourceFiles({
    cwd,
    include: config.source.include,
    exclude: config.source.exclude,
  });
}
