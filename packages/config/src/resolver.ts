import {
  TranslifyConfigSchema,
  type TranslifyConfig,
  type TranslifyConfigInput,
  ConfigValidationError,
} from '@ndnci/translify-shared';
import { dirname } from 'node:path';
import {
  resolveConfigPath,
  loadRawConfig,
  loadEnvFiles,
  type ResolvedConfigPath,
} from './loader.js';

export interface ResolveOptions {
  /** Working directory to search from */
  cwd: string;
  /** Explicit path to config file — skips automatic search */
  configPath?: string;
}

export interface ResolvedConfig {
  /** Fully validated and defaulted config */
  config: TranslifyConfig;
  /** Absolute path to the config file that was loaded */
  configPath: string;
  /** File format that was loaded */
  format: ResolvedConfigPath['format'];
}

/**
 * Resolves, loads, and validates the Translify config.
 *
 * This is the main entry point for all Translify commands.
 * It searches for the config file, loads it (supporting TS/JS/JSON),
 * applies Zod defaults, and validates the result.
 *
 * @throws ConfigNotFoundError if no config is found
 * @throws ConfigValidationError if the config has invalid values
 */
export async function resolveConfig(options: ResolveOptions): Promise<ResolvedConfig> {
  const resolved = resolveConfigPath(options.cwd, options.configPath);
  loadEnvFiles({ cwd: options.cwd, configDir: dirname(resolved.path) });
  const raw = await loadRawConfig(resolved);
  const config = validateConfig(raw);

  return {
    config,
    configPath: resolved.path,
    format: resolved.format,
  };
}

/**
 * Validates a raw config object against the Zod schema, applying defaults.
 *
 * @throws ConfigValidationError with structured issue details
 */
export function validateConfig(raw: TranslifyConfigInput): TranslifyConfig {
  const result = TranslifyConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    }));

    throw new ConfigValidationError('Invalid Translify configuration', issues);
  }

  return result.data;
}
