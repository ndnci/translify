import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'node22',
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  noExternal: ['@ndnci/translify-shared', '@ndnci/translify-config'],
});
