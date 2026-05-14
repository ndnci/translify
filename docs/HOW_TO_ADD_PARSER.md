# How to Add a New Parser (Framework Support)

This guide explains how to add support for a new framework or file format, such
as Vue SFCs, Angular templates, or PHP files.

---

## Background

The parsing pipeline in `packages/core` has two distinct steps:

1. **Parsing** (`src/parser/`) — reads a file and returns an AST
2. **Extraction** (`src/extractor/`) — traverses the AST to find translation
   keys

To support a new file format, you typically need to:

- Add a new parser (if Babel can't handle the file type)
- Extend the extractor (if the translation pattern is different)

---

## Step 1 — Identify the file format

Ask yourself:

- What file extension? (`.vue`, `.html`, `.php`, `.blade.php`, etc.)
- What AST library handles it? (Babel can handle Vue's `<script>` blocks)
- Where are translation keys used? (function calls? template directives? filter
  pipes?)

---

## Step 2 — Create a parser file

Create `packages/core/src/parser/<format>-parser.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { ParseError } from '@ndnci/translify-shared';

export interface ParsedFile {
  // The normalized structure your extractor will work with
  scriptContent: string;
  templateContent: string;
  filePath: string;
}

export function parseVueFile(filePath: string): ParsedFile {
  const source = readFileSync(filePath, 'utf8');

  // Parse with the appropriate library, e.g.:
  //   import { parse } from '@vue/compiler-sfc';
  //   const { descriptor } = parse(source);

  // ... your logic ...

  return {
    scriptContent: '', // extracted <script> block
    templateContent: '', // extracted <template> block
    filePath,
  };
}
```

If you can delegate to Babel (e.g. for the `<script>` block inside a `.vue`
file), re-use `parseSource` from `babel-parser.ts` after extracting the content.

---

## Step 3 — Extend the scanner

In `packages/core/src/scanner/file-scanner.ts`, the `scanSourceFiles` function
uses patterns from the config's `source.include`. Users add Vue support by
updating their config:

```ts
// translify.config.ts
source: {
  include: ['src/**/*.{ts,tsx,js,jsx,vue}'], // add 'vue'
}
```

No code change is needed for the scanner — just document the new pattern.

---

## Step 4 — Extend the extractor

In `packages/core/src/extractor/text-extractor.ts`, the `extractFromFile`
function currently delegates everything to Babel. Route new extensions to your
new parser:

```typescript
export function extractFromFile(options: ExtractOptions): ExtractionResult {
  // Detect file type
  if (options.file.endsWith('.vue')) {
    return extractFromVueFile(options);
  }

  // Default: Babel-based
  const ast = parseFile(options.file);
  // ...existing Babel extraction...
}
```

Create `extractFromVueFile` that:

1. Calls your `parseVueFile()`
2. Passes the script block through the Babel extractor
3. Scans the template block for template-specific patterns (e.g.
   `{{ $t('key') }}`)

---

## Step 5 — Add tests

Create `packages/core/src/__tests__/vue-extractor.test.ts` using a fixture
`.vue` file in `src/__tests__/fixtures/`.

---

## Step 6 — Export from the package

Add your new types/functions to `packages/core/src/index.ts` if they need to be
part of the public API.

---

## Step 7 — Update the config schema (if needed)

If your parser requires new configuration options, add them to:

- `packages/config/src/schema.ts` — Zod schema
- `apps/docs/guide/configuration.md` — documentation

---

## Step 8 — Submit a PR

Follow [CONTRIBUTING.md](../CONTRIBUTING.md) and include:

- The parser implementation
- The extractor extension
- Tests with fixtures
- A changeset (`pnpm changeset`)

---

## Babel-compatible formats (no new parser needed)

For frameworks that use standard JS/TS syntax (e.g. **Svelte** with a standard
`<script>` section), you can often get away with just:

1. Adding the extension to the user's `source.include` globs
2. Adjusting `parseFile()` in `babel-parser.ts` to strip non-JS content before
   parsing
3. Adding a test fixture

This is significantly less work than a full custom parser.
