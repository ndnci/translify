import { defineConfig } from 'tsup';

export default defineConfig([
  // CLI entry point — ESM with shebang, all workspace packages bundled in
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node22',
    dts: false,
    sourcemap: false,
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
    noExternal: [
      '@ndnci/translify-shared',
      '@ndnci/translify-config',
      '@ndnci/translify-core',
      '@ndnci/translify-ai',
    ],
  },
  // Re-export defineConfig for `@ndnci/translify/config` import path
  {
    entry: { 'config-entry': 'src/config-entry.ts' },
    format: ['cjs', 'esm'],
    target: 'node22',
    dts: true,
    sourcemap: false,
    clean: false,
    noExternal: ['@ndnci/translify-shared', '@ndnci/translify-config'],
  },
]);
