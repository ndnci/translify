import { resolve, join, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  CONFIG_FILE_NAMES,
  CONFIG_SEARCH_DIRS,
  ConfigNotFoundError,
  ConfigError,
  type TranslifyConfigInput,
} from '@ndnci/translify-shared';

const CONFIG_HELPER_SPECIFIER = '@ndnci/translify/config';
const ENV_FILE_NAMES = ['.env', '.env.local', '.env.{mode}', '.env.{mode}.local'] as const;

/**
 * `defineConfig` is a pure identity function used only for editor type
 * inference — it has no real runtime behavior. Rather than requiring
 * `@ndnci/translify/config` to be resolvable via Node's module resolution
 * (which fails when the CLI is installed globally, since a global install
 * isn't reachable from a project's `node_modules` chain), we alias the
 * import to a tiny inline shim so config files load regardless of how/where
 * the CLI is installed.
 */
function resolveConfigHelperShim(): string {
  const shimPath = join(tmpdir(), 'translify-config-helper.mjs');
  if (!existsSync(shimPath)) {
    writeFileSync(shimPath, 'export function defineConfig(config) { return config; }\n', 'utf8');
  }
  return shimPath;
}

export interface ResolvedConfigPath {
  path: string;
  format: 'ts' | 'js' | 'mjs' | 'cjs' | 'json';
}

export interface LoadEnvFilesOptions {
  /** Directory passed as the CLI cwd/project root */
  cwd: string;
  /** Directory containing the resolved config file */
  configDir: string;
  /** Runtime mode used for `.env.{mode}` files */
  mode?: string;
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

/**
 * Loads `.env` files before evaluating config files that reference
 * `process.env.*`. Existing shell variables keep priority.
 */
export function loadEnvFiles(options: LoadEnvFilesOptions): void {
  const mode = options.mode ?? process.env.NODE_ENV;
  const values: Record<string, string> = {};

  for (const dir of uniqueDirs([options.configDir, options.cwd])) {
    for (const envFile of envFileNames(mode)) {
      const path = join(dir, envFile);
      if (!existsSync(path)) continue;
      Object.assign(values, parseEnvFile(readFileSync(path, 'utf8')));
    }
  }

  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
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
      alias: {
        [CONFIG_HELPER_SPECIFIER]: resolveConfigHelperShim(),
      },
    });

    const mod = jiti(resolved.path) as { default?: TranslifyConfigInput } | TranslifyConfigInput;

    // Handle both `export default` and `module.exports`
    const config =
      (mod as { default?: TranslifyConfigInput }).default ?? (mod as TranslifyConfigInput);

    if (!config || typeof config !== 'object') {
      throw new ConfigError(
        `Config file at ${resolved.path} does not export a valid config object.\n` +
          `Make sure you use: export default { ... }`,
      );
    }

    return config;
  } catch (cause) {
    if (cause instanceof ConfigError) throw cause;
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new ConfigError(`Failed to load config from ${resolved.path}\n${reason}`, cause);
  }
}

function envFileNames(mode: string | undefined): string[] {
  return ENV_FILE_NAMES.flatMap((name) => {
    if (!name.includes('{mode}')) return [name];
    return mode ? [name.replace('{mode}', mode)] : [];
  });
}

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, key, rawValue = ''] = match;
    if (!key) continue;

    values[key] = parseEnvValue(rawValue);
  }

  return values;
}

function parseEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  return stripInlineComment(trimmed).trim();
}

function stripInlineComment(value: string): string {
  const commentIndex = value.search(/\s#/);
  return commentIndex === -1 ? value : value.slice(0, commentIndex);
}

function uniqueDirs(dirs: string[]): string[] {
  const normalized = dirs.map((dir) => resolve(dir));
  return [...new Set(normalized)];
}
