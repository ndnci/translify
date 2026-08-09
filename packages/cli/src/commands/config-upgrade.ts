import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import { applyEdits, modify } from 'jsonc-parser';
import { resolveConfigPath } from '@ndnci/translify-config';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';

export interface ConfigUpgradeOptions {
  cwd: string;
  configPath?: string;
  dryRun?: boolean;
}

type ObjectRange = {
  open: number;
  close: number;
};

const JSON_DEFAULTS = {
  source: {
    include: ['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}'],
    exclude: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**', '**/dist/**'],
  },
  translations: {
    default_language: 'en',
    files: ['messages/**/*.json'],
    split: {
      depth: 1,
      groups: [],
      group_match: 'keys',
      output_pattern: 'messages/{language}/{group}.json',
    },
  },
  extraction: {
    translation_functions: ['t', 'i18n.t', 'translate'],
    namespace_functions: ['useTranslations', 'getTranslations'],
    ignored_words: ['OK', 'API', 'ID'],
    ignored_patterns: ['^v[0-9]+$'],
    custom_regex_patterns: [],
    include_comments: false,
  },
  detection: {
    ignore_files_containing: [],
    ignore_paths_containing: [],
    ignore_filenames_matching: [],
  },
  ai_translation: {
    enabled: false,
    provider: 'openai',
    model: 'gpt-5.6-luna',
    temperature: 0,
    batch_size: 50,
    verify: false,
    values_only: false,
  },
};

const TOP_LEVEL_SNIPPETS = {
  source: `source: {
  include: ['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}'],
  exclude: [
    '**/*.test.*',
    '**/*.spec.*',
    '**/node_modules/**',
    '**/dist/**',
  ],
}`,
  translations: `translations: {
  default_language: 'en',
  files: ['messages/**/*.json'],
  split: {
    depth: 1,
    groups: [],
    group_match: 'keys',
    output_pattern: 'messages/{language}/{group}.json',
  },
}`,
  extraction: `extraction: {
  translation_functions: ['t', 'i18n.t', 'translate'],
  namespace_functions: ['useTranslations', 'getTranslations'],
  ignored_words: ['OK', 'API', 'ID'],
  ignored_patterns: ['^v[0-9]+$'],
  custom_regex_patterns: [],
  include_comments: false,
}`,
  detection: `detection: {
  ignore_files_containing: [],
  ignore_paths_containing: [],
  ignore_filenames_matching: [],
}`,
  ai_translation: `ai_translation: {
  enabled: false,
  provider: 'openai',
  openai_api_key: process.env.OPENAI_API_KEY,
  openrouter_api_key: process.env.OPENROUTER_API_KEY,
  model: 'gpt-5.6-luna',
  temperature: 0,
  batch_size: 50,
  verify: false,
  verify_model: undefined,
  values_only: false,
}`,
} as const;

const NESTED_SNIPPETS: Array<{ path: string[]; key: string; snippet: string }> = [
  {
    path: ['source'],
    key: 'include',
    snippet: "include: ['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}']",
  },
  {
    path: ['source'],
    key: 'exclude',
    snippet: `exclude: [
  '**/*.test.*',
  '**/*.spec.*',
  '**/node_modules/**',
  '**/dist/**',
]`,
  },
  { path: ['translations'], key: 'default_language', snippet: "default_language: 'en'" },
  { path: ['translations'], key: 'files', snippet: "files: ['messages/**/*.json']" },
  {
    path: ['translations'],
    key: 'split',
    snippet: `split: {
  depth: 1,
  groups: [],
  group_match: 'keys',
  output_pattern: 'messages/{language}/{group}.json',
}`,
  },
  { path: ['translations', 'split'], key: 'depth', snippet: 'depth: 1' },
  { path: ['translations', 'split'], key: 'groups', snippet: 'groups: []' },
  { path: ['translations', 'split'], key: 'group_match', snippet: "group_match: 'keys'" },
  {
    path: ['translations', 'split'],
    key: 'output_pattern',
    snippet: "output_pattern: 'messages/{language}/{group}.json'",
  },
  {
    path: ['extraction'],
    key: 'translation_functions',
    snippet: "translation_functions: ['t', 'i18n.t', 'translate']",
  },
  {
    path: ['extraction'],
    key: 'namespace_functions',
    snippet: "namespace_functions: ['useTranslations', 'getTranslations']",
  },
  { path: ['extraction'], key: 'ignored_words', snippet: "ignored_words: ['OK', 'API', 'ID']" },
  { path: ['extraction'], key: 'ignored_patterns', snippet: "ignored_patterns: ['^v[0-9]+$']" },
  { path: ['extraction'], key: 'custom_regex_patterns', snippet: 'custom_regex_patterns: []' },
  { path: ['extraction'], key: 'include_comments', snippet: 'include_comments: false' },
  { path: ['detection'], key: 'ignore_files_containing', snippet: 'ignore_files_containing: []' },
  { path: ['detection'], key: 'ignore_paths_containing', snippet: 'ignore_paths_containing: []' },
  {
    path: ['detection'],
    key: 'ignore_filenames_matching',
    snippet: 'ignore_filenames_matching: []',
  },
  { path: ['ai_translation'], key: 'enabled', snippet: 'enabled: false' },
  { path: ['ai_translation'], key: 'provider', snippet: "provider: 'openai'" },
  {
    path: ['ai_translation'],
    key: 'openai_api_key',
    snippet: 'openai_api_key: process.env.OPENAI_API_KEY',
  },
  {
    path: ['ai_translation'],
    key: 'openrouter_api_key',
    snippet: 'openrouter_api_key: process.env.OPENROUTER_API_KEY',
  },
  { path: ['ai_translation'], key: 'model', snippet: "model: 'gpt-5.6-luna'" },
  { path: ['ai_translation'], key: 'temperature', snippet: 'temperature: 0' },
  { path: ['ai_translation'], key: 'batch_size', snippet: 'batch_size: 50' },
  { path: ['ai_translation'], key: 'verify', snippet: 'verify: false' },
  { path: ['ai_translation'], key: 'verify_model', snippet: 'verify_model: undefined' },
  { path: ['ai_translation'], key: 'values_only', snippet: 'values_only: false' },
];

export function registerConfigUpgradeCommand(program: Command, logger: CliLogger): void {
  program
    .command('config-upgrade')
    .description('Add new config keys without overwriting existing values')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify config-upgrade
  ${c.brand('$')} translify config-upgrade --dry-run
  ${c.brand('$')} translify --config ./translify.config.ts config-upgrade
`,
    )
    .action(async () => {
      const opts = program.opts<{
        cwd: string;
        config?: string;
        dryRun: boolean;
      }>();

      await runConfigUpgrade(
        {
          cwd: opts.cwd,
          ...(opts.config && { configPath: opts.config }),
          dryRun: opts.dryRun,
        },
        logger,
      );
    });
}

export async function runConfigUpgrade(
  options: ConfigUpgradeOptions,
  logger: CliLogger,
): Promise<void> {
  const resolved =
    existsSync(join(options.cwd, 'translify.config.ts')) || options.configPath
      ? resolveConfigPath(options.cwd, options.configPath)
      : resolveConfigPath(options.cwd);
  const original = readFileSync(resolved.path, 'utf8');
  const upgraded =
    resolved.format === 'json' ? upgradeJsonConfig(original) : upgradeJavaScriptConfig(original);

  if (upgraded.content === original) {
    logger.success(`Config already up to date: ${c.file(resolved.path)}`);
    return;
  }

  if (!options.dryRun) {
    writeFileSync(resolved.path, upgraded.content, 'utf8');
  }

  logger.success(
    options.dryRun
      ? `[dry-run] Would update ${c.file(resolved.path)}`
      : `Updated ${c.file(resolved.path)}`,
  );
  for (const change of upgraded.changes) {
    process.stdout.write(`  ${c.success('+')} ${change}\n`);
  }
}

export function upgradeJsonConfig(source: string): { content: string; changes: string[] } {
  let content = source;
  const current = JSON.parse(source) as unknown;
  const additions = collectMissingJsonPaths(current, JSON_DEFAULTS);
  for (const addition of additions) {
    const edits = modify(content, addition.path, addition.value, {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
    });
    content = applyEdits(content, edits);
  }

  return {
    content: content.endsWith('\n') ? content : `${content}\n`,
    changes: additions.map((addition) => addition.path.join('.')),
  };
}

export function upgradeJavaScriptConfig(source: string): { content: string; changes: string[] } {
  let content = source;
  const changes: string[] = [];

  for (const [key, snippet] of Object.entries(TOP_LEVEL_SNIPPETS)) {
    const result = ensureProperty(content, [], key, snippet);
    content = result.content;
    if (result.changed) changes.push(key);
  }

  for (const item of NESTED_SNIPPETS) {
    const result = ensureProperty(content, item.path, item.key, item.snippet);
    content = result.content;
    if (result.changed) changes.push([...item.path, item.key].join('.'));
  }

  return { content, changes };
}

function collectMissingJsonPaths(
  current: unknown,
  defaults: unknown,
  path: Array<string | number> = [],
): Array<{ path: Array<string | number>; value: unknown }> {
  if (!isPlainObject(defaults)) return [];
  const additions: Array<{ path: Array<string | number>; value: unknown }> = [];
  const currentObject = isPlainObject(current) ? current : {};

  for (const [key, value] of Object.entries(defaults)) {
    const nextPath = [...path, key];
    if (!Object.hasOwn(currentObject, key)) {
      additions.push({ path: nextPath, value });
      continue;
    }
    additions.push(...collectMissingJsonPaths(currentObject[key], value, nextPath));
  }

  return additions;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ensureProperty(
  source: string,
  objectPath: string[],
  key: string,
  snippet: string,
): { content: string; changed: boolean } {
  const objectRange = findObjectByPath(source, objectPath);
  if (!objectRange) return { content: source, changed: false };
  if (findProperty(source, objectRange, key)) return { content: source, changed: false };

  return {
    content: insertProperty(source, objectRange, snippet),
    changed: true,
  };
}

function findObjectByPath(source: string, path: string[]): ObjectRange | null {
  let current = findRootObject(source);
  if (!current) return null;

  for (const key of path) {
    const property = findProperty(source, current, key);
    if (!property?.objectValue) return null;
    current = property.objectValue;
  }

  return current;
}

function findRootObject(source: string): ObjectRange | null {
  const marker = source.indexOf('export default');
  const searchStart = marker >= 0 ? marker : 0;
  const open = source.indexOf('{', searchStart);
  if (open < 0) return null;
  const close = findMatchingBrace(source, open);
  return close < 0 ? null : { open, close };
}

function findProperty(
  source: string,
  objectRange: ObjectRange,
  key: string,
): { valueStart: number; valueEnd: number; objectValue?: ObjectRange } | null {
  let index = objectRange.open + 1;

  while (index < objectRange.close) {
    index = skipWhitespaceAndComments(source, index);
    if (index >= objectRange.close) break;

    const parsedKey = parsePropertyKey(source, index);
    if (!parsedKey) {
      index = skipIgnorable(source, index);
      index++;
      continue;
    }

    let colon = skipWhitespaceAndComments(source, parsedKey.end);
    if (source[colon] !== ':') {
      index = parsedKey.end;
      continue;
    }

    const valueStart = skipWhitespaceAndComments(source, colon + 1);
    const valueEnd = findValueEnd(source, valueStart, objectRange.close);
    const objectValue =
      source[valueStart] === '{'
        ? {
            open: valueStart,
            close: findMatchingBrace(source, valueStart),
          }
        : undefined;

    if (parsedKey.key === key) {
      return {
        valueStart,
        valueEnd,
        ...(objectValue && objectValue.close > objectValue.open && { objectValue }),
      };
    }

    index = valueEnd + 1;
  }

  return null;
}

function parsePropertyKey(source: string, index: number): { key: string; end: number } | null {
  const char = source[index];
  if (char === '"' || char === "'") {
    const end = readStringEnd(source, index);
    return { key: source.slice(index + 1, end - 1), end };
  }

  if (!char || !/[A-Za-z_$]/.test(char)) return null;

  let end = index + 1;
  while (end < source.length && /[A-Za-z0-9_$]/.test(source[end]!)) end++;
  return { key: source.slice(index, end), end };
}

function insertProperty(source: string, objectRange: ObjectRange, snippet: string): string {
  const objectIndent = indentationBefore(source, objectRange.open);
  const childIndent = detectChildIndent(source, objectRange) ?? `${objectIndent}  `;
  const last = previousNonWhitespace(source, objectRange.close - 1);
  const needsComma = last >= 0 && source[last] !== '{' && source[last] !== ',';
  const insertion =
    `${needsComma ? ',' : ''}\n` + indentSnippet(snippet, childIndent) + `\n${objectIndent}`;

  return source.slice(0, objectRange.close) + insertion + source.slice(objectRange.close);
}

function indentSnippet(snippet: string, indent: string): string {
  return snippet
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
}

function detectChildIndent(source: string, objectRange: ObjectRange): string | null {
  const body = source.slice(objectRange.open + 1, objectRange.close);
  const match = body.match(/\n([ \t]*)\S/);
  return match?.[1] ?? null;
}

function indentationBefore(source: string, index: number): string {
  const lineStart = source.lastIndexOf('\n', index) + 1;
  const match = source.slice(lineStart, index).match(/^[ \t]*/);
  return match?.[0] ?? '';
}

function previousNonWhitespace(source: string, index: number): number {
  let current = index;
  while (current >= 0 && /\s/.test(source[current]!)) current--;
  return current;
}

function findValueEnd(source: string, start: number, objectClose: number): number {
  let index = start;
  let depth = 0;

  while (index < objectClose) {
    const next = skipIgnorable(source, index);
    if (next !== index) {
      index = next;
      continue;
    }

    const char = source[index];
    if (char === '{' || char === '[' || char === '(') depth++;
    if (char === '}' || char === ']' || char === ')') depth--;
    if (char === ',' && depth === 0) return index;
    index++;
  }

  return objectClose;
}

function findMatchingBrace(source: string, open: number): number {
  let index = open;
  let depth = 0;

  while (index < source.length) {
    const next = skipIgnorable(source, index);
    if (next !== index) {
      index = next;
      continue;
    }

    if (source[index] === '{') depth++;
    if (source[index] === '}') {
      depth--;
      if (depth === 0) return index;
    }
    index++;
  }

  return -1;
}

function skipWhitespaceAndComments(source: string, index: number): number {
  let current = index;
  while (current < source.length) {
    while (current < source.length && /\s/.test(source[current]!)) current++;
    const next = skipComment(source, current);
    if (next === current) return current;
    current = next;
  }
  return current;
}

function skipIgnorable(source: string, index: number): number {
  const char = source[index];
  if (char === '"' || char === "'" || char === '`') return readStringEnd(source, index);
  return skipComment(source, index);
}

function skipComment(source: string, index: number): number {
  if (source[index] === '/' && source[index + 1] === '/') {
    const end = source.indexOf('\n', index + 2);
    return end < 0 ? source.length : end + 1;
  }

  if (source[index] === '/' && source[index + 1] === '*') {
    const end = source.indexOf('*/', index + 2);
    return end < 0 ? source.length : end + 2;
  }

  return index;
}

function readStringEnd(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;

  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index++;
  }

  return source.length;
}
