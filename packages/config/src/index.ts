export { defineConfig } from './define.js';
export { resolveConfig, validateConfig } from './resolver.js';
export { resolveConfigPath, loadRawConfig } from './loader.js';
export { TranslifyConfigSchema } from '@ndnci/translify-shared';
export type { TranslifyConfig, TranslifyConfigInput, UserConfig } from '@ndnci/translify-shared';
export type { ResolvedConfig, ResolveOptions } from './resolver.js';
export type { ResolvedConfigPath } from './loader.js';
