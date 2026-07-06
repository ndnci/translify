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
    // Third-party deps pulled in transitively by the bundled workspace
    // packages above must stay external: several (fast-glob, jiti) are CJS
    // modules with dynamic `require()` calls to Node builtins that esbuild
    // can't translate when bundling into ESM output.
    external: [
      '@babel/parser',
      '@babel/traverse',
      '@babel/types',
      'fast-glob',
      'jiti',
      'jsonc-parser',
      '@openrouter/sdk',
      'openai',
      'zod',
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
