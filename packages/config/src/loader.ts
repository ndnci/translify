import { resolve, join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import {
  CONFIG_FILE_NAMES,
  CONFIG_SEARCH_DIRS,
  ConfigNotFoundError,
  ConfigError,
  type TranslifyConfigInput,
} from '@ndnci/translify-shared';

export interface ResolvedConfigPath {
  path: string;
  format: 'ts' | 'js' | 'mjs' | 'cjs' | 'json';
}

/**
 * Searches for a Translify config file starting from `cwd`, checking all
 * supported file names and sub-directories.
 *
 * Returns the absolute path + format, or throws ConfigNotFoundError.
 */
export function resolveConfigPath(cwd: string, explicitPath?: string): ResolvedConfigPath {
  if (explicitPath) {
    const abs = resolve(cwd, explicitPath);
    if (!existsSync(abs)) {
      throw new ConfigError(`Config file not found: ${abs}`);
    }
    return { path: abs, format: detectFormat(abs) };
  }

  const searched: string[] = [];

  for (const dir of CONFIG_SEARCH_DIRS) {
    for (const name of CONFIG_FILE_NAMES) {
      const candidate = resolve(cwd, dir === '.' ? name : join(dir, name));
      searched.push(candidate);
      if (existsSync(candidate)) {
        return { path: candidate, format: detectFormat(candidate) };
      }
    }
  }

  throw new ConfigNotFoundError(searched);
}

function detectFormat(filePath: string): ResolvedConfigPath['format'] {
  if (filePath.endsWith('.ts')) return 'ts';
  if (filePath.endsWith('.mjs')) return 'mjs';
  if (filePath.endsWith('.cjs')) return 'cjs';
  if (filePath.endsWith('.json')) return 'json';
  return 'js';
}

/**
 * Loads a raw (unvalidated) config from the resolved path.
 * Handles JSON directly; delegates TS/JS/ESM to jiti.
 */
export async function loadRawConfig(resolved: ResolvedConfigPath): Promise<TranslifyConfigInput> {
  if (resolved.format === 'json') {
    try {
      const content = readFileSync(resolved.path, 'utf8');
      return JSON.parse(content) as TranslifyConfigInput;
    } catch (cause) {
      throw new ConfigError(`Failed to parse JSON config at ${resolved.path}`, cause);
    }
  }

  // Use jiti for TS, JS, MJS, CJS — it handles all of them seamlessly.
  try {
    // Dynamic import of jiti to keep it optional at type level
    const { default: createJiti } = (await import('jiti')) as {
      default: (base: string, opts?: Record<string, unknown>) => (id: string) => unknown;
    };

    const jiti = createJiti(dirname(resolved.path), {
      interopDefault: true,
      cache: false,
      requireCache: false,
    });

    const mod = jiti(resolved.path) as { default?: TranslifyConfigInput } | TranslifyConfigInput;

    // Handle both `export default` and `module.exports`
    const config =
      (mod as { default?: TranslifyConfigInput }).default ?? (mod as TranslifyConfigInput);

    if (!config || typeof config !== 'object') {
      throw new ConfigError(
        `Config file at ${resolved.path} does not export a valid config object.\n` +
          `Make sure you use: export default defineConfig({ ... })`,
      );
    }

    return config;
  } catch (cause) {
    if (cause instanceof ConfigError) throw cause;
    throw new ConfigError(`Failed to load config from ${resolved.path}`, cause);
  }
}
