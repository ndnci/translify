import { describe, it, expect } from 'vitest';
import { parseSource } from '../parser/babel-parser.js';
import { extractFromFile } from '../extractor/text-extractor.js';
import { join } from 'node:path';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('parseSource', () => {
  it('parses a simple TypeScript file', () => {
    const ast = parseSource(`const x: string = 'hello';`, 'file.ts');
    expect(ast.type).toBe('File');
  });

  it('parses a TSX file with JSX', () => {
    const ast = parseSource(`export const Comp = () => <div>Hello</div>;`, 'comp.tsx');
    expect(ast.type).toBe('File');
  });

  it('parses optional chaining', () => {
    const ast = parseSource(`const x = obj?.foo?.bar;`, 'file.ts');
    expect(ast.type).toBe('File');
  });
});

describe('extractFromFile (integration)', () => {
  const dir = join(tmpdir(), 'translify-test-' + process.pid);
  const file = join(dir, 'test.tsx');

  beforeAll(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      file,
      `
import { useTranslation } from 'next-intl';

export function Page() {
  const t = useTranslation();
  const title = t('home.title');
  const desc = t('home.description');
  const ok = i18n.t('buttons.ok');
  return <div>{t('page.body')}</div>;
}
`,
    );
  });

  afterAll(() => {
    unlinkSync(file);
  });

  it('extracts string literals from translation function calls', () => {
    const result = extractFromFile({
      file,
      translationFunctions: ['t', 'i18n.t'],
      ignoredWords: [],
      ignoredPatterns: [],
    });

    const keys = result.entries.map((e) => e.key);
    expect(keys).toContain('home.title');
    expect(keys).toContain('home.description');
    expect(keys).toContain('buttons.ok');
    expect(keys).toContain('page.body');
  });

  it('tracks line numbers', () => {
    const result = extractFromFile({
      file,
      translationFunctions: ['t'],
      ignoredWords: [],
      ignoredPatterns: [],
    });

    const titleEntry = result.entries.find((e) => e.key === 'home.title');
    expect(titleEntry).toBeDefined();
    expect(titleEntry!.line).toBeGreaterThan(0);
  });
});
