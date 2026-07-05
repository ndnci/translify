import _traverse from '@babel/traverse';
import type { Binding } from '@babel/traverse';
import type {
  ArgumentPlaceholder,
  Expression,
  SpreadElement,
  StringLiteral,
  TemplateLiteral,
  V8IntrinsicIdentifier,
} from '@babel/types';
import {
  type ExtractionEntry,
  type ExtractionResult,
  matchesAnyPattern,
} from '@ndnci/translify-shared';
import { parseFile } from '../parser/babel-parser.js';

// @babel/traverse uses a CJS default export that needs this interop in ESM context
const traverse =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: typeof _traverse }).default;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractOptions {
  /** Absolute path to the source file */
  file: string;
  /** Function names/expressions to treat as translation calls, e.g. ["t", "i18n.t"] */
  translationFunctions: string[];
  /**
   * Namespace-hook function names, e.g. ["useTranslations", "getTranslations"].
   * A variable bound to one of these calls with a static namespace prefixes
   * every translation-function call made through that variable.
   */
  namespaceFunctions?: string[];
  /** Exact words to ignore */
  ignoredWords: string[];
  /** Regex patterns to ignore */
  ignoredPatterns: string[];
}

// ─── Main extractor ────────────────────────────────────────────────────────────

/**
 * Extracts all translation key usages from a single source file.
 *
 * Walks the Babel AST and collects every call to a configured translation
 * function where the first argument is a static string literal.
 */
export function extractFromFile(options: ExtractOptions): ExtractionResult {
  const ast = parseFile(options.file);
  const entries: ExtractionEntry[] = [];

  const parsedFunctions = options.translationFunctions.map(parseFunctionSpec);
  const parsedNamespaceFunctions = (options.namespaceFunctions ?? []).map(parseFunctionSpec);

  // Maps a variable binding (not just a name, to respect shadowing/scoping)
  // to the static namespace it was created with, e.g.
  // `const t = useTranslations("CommonMessage")` -> binding for `t` -> "CommonMessage"
  const namespaceByBinding = new Map<Binding, string>();

  traverse(ast, {
    VariableDeclarator(path) {
      const { node } = path;
      if (node.id.type !== 'Identifier' || !node.init) return;

      // Unwrap `await getTranslations(...)`
      const init = node.init.type === 'AwaitExpression' ? node.init.argument : node.init;
      if (!init || init.type !== 'CallExpression') return;

      const call = init;
      const matchedHook = parsedNamespaceFunctions.find((fn) => matchesCallee(call.callee, fn));
      if (!matchedHook) return;

      const namespace = extractStaticNamespace(call.arguments[0]);
      if (!namespace) return;

      const binding = path.scope.getBinding(node.id.name);
      if (binding) namespaceByBinding.set(binding, namespace);
    },

    CallExpression(path) {
      const { node } = path;
      const callee = node.callee;

      const matchedFn = parsedFunctions.find((fn) => matchesCallee(callee, fn));
      if (!matchedFn) return;

      let namespace: string | undefined;
      if (callee.type === 'Identifier') {
        const binding = path.scope.getBinding(callee.name);
        if (binding) namespace = namespaceByBinding.get(binding);
      }

      const firstArg = node.arguments[0];
      if (!firstArg) return;

      if (firstArg.type === 'StringLiteral') {
        const key = applyNamespace((firstArg as StringLiteral).value, namespace);

        if (shouldIgnoreKey(key, options.ignoredWords, options.ignoredPatterns)) return;

        entries.push({
          key,
          file: options.file,
          line: node.loc?.start.line ?? 0,
          column: node.loc?.start.column ?? 0,
          type: 'translation-call',
          callExpression: matchedFn.raw,
        });
      } else if (firstArg.type === 'TemplateLiteral') {
        // Template literals with no expressions are static strings
        const tl = firstArg as TemplateLiteral;
        if (tl.expressions.length === 0 && tl.quasis[0]) {
          const key = applyNamespace(
            tl.quasis[0].value.cooked ?? tl.quasis[0].value.raw,
            namespace,
          );

          if (shouldIgnoreKey(key, options.ignoredWords, options.ignoredPatterns)) return;

          entries.push({
            key,
            file: options.file,
            line: node.loc?.start.line ?? 0,
            column: node.loc?.start.column ?? 0,
            type: 'translation-call',
            callExpression: matchedFn.raw,
          });
        }
      }
    },
  });

  return {
    entries,
    file: options.file,
    count: entries.length,
  };
}

/**
 * Extracts translation keys from multiple files in parallel.
 */
export async function extractFromFiles(
  files: string[],
  options: Omit<ExtractOptions, 'file'>,
): Promise<ExtractionResult[]> {
  return Promise.all(files.map((file) => Promise.resolve(extractFromFile({ ...options, file }))));
}

/**
 * Merges multiple ExtractionResults and deduplicates keys.
 * Returns a Set of unique keys found across all files.
 */
export function mergeExtractedKeys(results: ExtractionResult[]): Set<string> {
  const keys = new Set<string>();
  for (const result of results) {
    for (const entry of result.entries) {
      keys.add(entry.key);
    }
  }
  return keys;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ParsedFunctionSpec {
  raw: string;
  type: 'identifier' | 'member';
  /** For 'identifier': the function name */
  name?: string;
  /** For 'member': the object and property */
  object?: string;
  property?: string;
}

function parseFunctionSpec(spec: string): ParsedFunctionSpec {
  const dot = spec.indexOf('.');
  if (dot === -1) {
    return { raw: spec, type: 'identifier', name: spec };
  }
  return {
    raw: spec,
    type: 'member',
    object: spec.slice(0, dot),
    property: spec.slice(dot + 1),
  };
}

function matchesCallee(
  callee: Expression | V8IntrinsicIdentifier,
  fn: ParsedFunctionSpec,
): boolean {
  if (fn.type === 'identifier') {
    return callee.type === 'Identifier' && callee.name === fn.name;
  }

  if (fn.type === 'member') {
    return (
      callee.type === 'MemberExpression' &&
      !callee.computed &&
      callee.object.type === 'Identifier' &&
      callee.object.name === fn.object &&
      callee.property.type === 'Identifier' &&
      callee.property.name === fn.property
    );
  }

  return false;
}

function shouldIgnoreKey(key: string, ignoredWords: string[], ignoredPatterns: string[]): boolean {
  if (!key.trim()) return true;
  if (ignoredWords.includes(key)) return true;
  if (matchesAnyPattern(key, ignoredPatterns)) return true;
  return false;
}

/**
 * Extracts a static namespace string from a namespace-hook call's first
 * argument, supporting both `useTranslations("Namespace")` and
 * `getTranslations({ namespace: "Namespace" })` shapes.
 */
function extractStaticNamespace(
  arg: Expression | SpreadElement | ArgumentPlaceholder | undefined,
): string | undefined {
  if (!arg || arg.type === 'ArgumentPlaceholder' || arg.type === 'SpreadElement') {
    return undefined;
  }

  if (arg.type === 'StringLiteral') {
    return arg.value;
  }

  if (arg.type === 'ObjectExpression') {
    for (const prop of arg.properties) {
      if (
        prop.type === 'ObjectProperty' &&
        !prop.computed &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'namespace' &&
        prop.value.type === 'StringLiteral'
      ) {
        return prop.value.value;
      }
    }
  }

  return undefined;
}

function applyNamespace(key: string, namespace: string | undefined): string {
  return namespace ? `${namespace}.${key}` : key;
}
