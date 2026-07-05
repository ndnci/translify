import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

describe('extractFromFile (namespace-aware)', () => {
  const dir = join(tmpdir(), 'translify-test-ns-' + process.pid);
  const file = join(dir, 'namespaced.tsx');

  beforeAll(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      file,
      `
import { useTranslations, getTranslations } from 'next-intl';

export function ToolPage() {
  const t = useTranslations("CommonMessage");
  const label = t("pleaseLogin");
  const plain = greet("hello");
  return <div>{label}</div>;
}

export async function serverFn() {
  const t = await getTranslations({ namespace: "ServerCommon" });
  return t("welcome");
}
`,
    );
  });

  afterAll(() => {
    unlinkSync(file);
  });

  it('prefixes keys with the namespace bound via useTranslations', () => {
    const result = extractFromFile({
      file,
      translationFunctions: ['t', 'greet'],
      namespaceFunctions: ['useTranslations', 'getTranslations'],
      ignoredWords: [],
      ignoredPatterns: [],
    });

    const keys = result.entries.map((e) => e.key);
    expect(keys).toContain('CommonMessage.pleaseLogin');
    expect(keys).not.toContain('pleaseLogin');
  });

  it('prefixes keys with the namespace bound via getTranslations({ namespace })', () => {
    const result = extractFromFile({
      file,
      translationFunctions: ['t'],
      namespaceFunctions: ['useTranslations', 'getTranslations'],
      ignoredWords: [],
      ignoredPatterns: [],
    });

    const keys = result.entries.map((e) => e.key);
    expect(keys).toContain('ServerCommon.welcome');
  });

  it('leaves non-namespaced translation calls unaffected', () => {
    const result = extractFromFile({
      file,
      translationFunctions: ['t', 'greet'],
      namespaceFunctions: ['useTranslations', 'getTranslations'],
      ignoredWords: [],
      ignoredPatterns: [],
    });

    const keys = result.entries.map((e) => e.key);
    expect(keys).toContain('hello');
  });
});

describe('extractFromFile (custom wrapper hooks, resolved cross-file)', () => {
  const dir = join(tmpdir(), 'translify-test-wrapper-' + process.pid);
  const hooksDir = join(dir, 'hooks');
  const componentsDir = join(dir, 'components');
  const hookFile = join(hooksDir, 'useFeatureI18n.ts');
  const consumerFile = join(componentsDir, 'WidgetPanel.tsx');

  beforeAll(() => {
    mkdirSync(hooksDir, { recursive: true });
    mkdirSync(componentsDir, { recursive: true });

    // Mirrors a real wrapper hook: `t` inherits the caller's namespace,
    // `tc` is hardcoded to a different, shared namespace.
    writeFileSync(
      hookFile,
      `
import { useTranslations } from 'next-intl';

export function useFeatureI18n(featureNamespace: string) {
  const t = useTranslations(featureNamespace);
  const tc = useTranslations("Shared");
  return { t, tc };
}
`,
    );

    writeFileSync(
      consumerFile,
      `
import { useFeatureI18n } from '../hooks/useFeatureI18n';

export function WidgetPanel() {
  const { t, tc } = useFeatureI18n("WidgetPanel");
  const placeholder = t("label.titlePlaceholder");
  const shared = tc("helperText");
  return <div>{placeholder}{shared}</div>;
}
`,
    );
  });

  afterAll(() => {
    unlinkSync(hookFile);
    unlinkSync(consumerFile);
  });

  it("resolves each destructured property to the wrapper's own namespace, not the outer call's", () => {
    const result = extractFromFile({
      file: consumerFile,
      translationFunctions: ['t', 'tc'],
      namespaceFunctions: ['useTranslations', 'useFeatureI18n'],
      ignoredWords: [],
      ignoredPatterns: [],
    });

    const keys = result.entries.map((e) => e.key);
    expect(keys).toContain('WidgetPanel.label.titlePlaceholder');
    expect(keys).toContain('Shared.helperText');
    expect(keys).not.toContain('WidgetPanel.helperText');
  });
});

describe('extractFromFile (hardcoded text)', () => {
  const dir = join(tmpdir(), 'translify-test-hardcoded-' + process.pid);
  const file = join(dir, 'hardcoded.tsx');

  beforeAll(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      file,
      `
import { Button } from './Button';

export function Page() {
  const t = useTranslations("Home");
  const serverT = getTranslations({ namespace: "ServerHome" });
  return (
    <main>
      <h1>Welcome home</h1>
      <button>Login</button>
      <input placeholder="Search tools" className="rounded-md" />
      <Button>{t("actions.save")}</Button>
    </main>
  );
}
`,
    );
  });

  afterAll(() => {
    unlinkSync(file);
  });

  it('detects visible hardcoded text without flagging translation keys or technical strings', () => {
    const result = extractFromFile({
      file,
      translationFunctions: ['t'],
      namespaceFunctions: ['useTranslations', 'getTranslations'],
      ignoredWords: [],
      ignoredPatterns: [],
      detectHardcodedText: true,
    });

    const hardcoded = result.entries
      .filter((entry) => entry.type === 'hardcoded-text')
      .map((entry) => entry.key);

    expect(hardcoded).toContain('Welcome home');
    expect(hardcoded).toContain('Login');
    expect(hardcoded).toContain('Search tools');
    expect(hardcoded).not.toContain('./Button');
    expect(hardcoded).not.toContain('actions.save');
    expect(hardcoded).not.toContain('ServerHome');
  });
});
