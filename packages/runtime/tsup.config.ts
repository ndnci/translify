import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    target: 'es2022',
    platform: 'neutral',
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
  },
  {
    entry: ['src/next.ts'],
    format: ['cjs', 'esm'],
    target: 'es2022',
    platform: 'neutral',
    dts: true,
    sourcemap: true,
    clean: false,
    treeshake: true,
  },
  {
    entry: ['src/react.tsx'],
    format: ['cjs', 'esm'],
    target: 'es2022',
    platform: 'neutral',
    dts: true,
    sourcemap: true,
    clean: false,
    treeshake: false,
    external: ['react', 'react/jsx-runtime'],
    banner: { js: "'use client';" },
  },
]);
