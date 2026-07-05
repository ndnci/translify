import _traverse from '@babel/traverse';
import type { Binding, NodePath } from '@babel/traverse';
import type { StringLiteral, TemplateLiteral } from '@babel/types';
import {
  type ExtractionEntry,
  type ExtractionResult,
  matchesAnyPattern,
} from '@ndnci/translify-shared';
import { parseFile } from '../parser/babel-parser.js';
import {
  type ParsedFunctionSpec,
  parseFunctionSpec,
  matchesCallee,
  extractStaticNamespace,
} from './ast-helpers.js';
import { resolveModuleSpecifier, resolveWrapperHook } from './wrapper-hook-resolver.js';

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
   * every translation-function call made through that variable. Also used
   * to recognize custom wrapper hooks (e.g. a project's own `useFeatureI18n`)
   * — their own definition is resolved and analyzed the same way.
   */
  namespaceFunctions?: string[];
  /** Exact words to ignore */
  ignoredWords: string[];
  /** Regex patterns to ignore */
  ignoredPatterns: string[];
  /** Also detect user-facing text that is not wrapped in a translation call */
  detectHardcodedText?: boolean;
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

  // `import { useFeatureI18n } from '../hooks/useFeatureI18n'` -> local name -> source
  const importedFrom = new Map<string, { source: string; imported: string }>();

  const addHardcodedEntry = (
    text: string,
    loc: { line?: number; column?: number } | null | undefined,
  ) => {
    const normalized = normalizeHardcodedText(text);
    if (!normalized) return;
    if (shouldIgnoreHardcodedText(normalized, options.ignoredWords, options.ignoredPatterns))
      return;

    entries.push({
      key: normalized,
      file: options.file,
      line: loc?.line ?? 0,
      column: loc?.column ?? 0,
      type: 'hardcoded-text',
    });
  };

  traverse(ast, {
    ImportDeclaration(path) {
      for (const spec of path.node.specifiers) {
        if (spec.type === 'ImportSpecifier' && spec.imported.type === 'Identifier') {
          importedFrom.set(spec.local.name, {
            source: path.node.source.value,
            imported: spec.imported.name,
          });
        }
      }
    },

    VariableDeclarator(path) {
      const { node } = path;
      if (!node.init) return;

      // Unwrap `await getTranslations(...)`
      const init = node.init.type === 'AwaitExpression' ? node.init.argument : node.init;
      if (!init || init.type !== 'CallExpression') return;

      const call = init;
      const matchedHook = parsedNamespaceFunctions.find((fn) => matchesCallee(call.callee, fn));
      if (!matchedHook) return;

      const namespace = extractStaticNamespace(call.arguments[0]);

      // `const t = useTranslations("Namespace")`
      if (node.id.type === 'Identifier') {
        if (!namespace) return;
        const binding = path.scope.getBinding(node.id.name);
        if (binding) namespaceByBinding.set(binding, namespace);
        return;
      }

      // `const { t, tc } = useFeatureI18n("Namespace")` — resolve the wrapper
      // hook's own definition to find each returned property's real
      // namespace (which may differ per property, e.g. a shared `tc`).
      // Falls back to the call's own namespace for anything unresolved.
      if (node.id.type === 'ObjectPattern') {
        const wrapperInfo =
          call.callee.type === 'Identifier'
            ? resolveWrapperInfo(
                options.file,
                importedFrom,
                call.callee.name,
                parsedNamespaceFunctions,
              )
            : null;

        for (const prop of node.id.properties) {
          if (prop.type !== 'ObjectProperty' || prop.value.type !== 'Identifier') continue;
          const propKey = prop.key.type === 'Identifier' ? prop.key.name : null;
          const binding = path.scope.getBinding(prop.value.name);
          if (!binding) continue;

          const mapping = propKey ? wrapperInfo?.properties.get(propKey) : undefined;
          if (mapping?.type === 'fixed') {
            namespaceByBinding.set(binding, mapping.namespace);
          } else if (mapping?.type === 'param') {
            const argNamespace = extractStaticNamespace(call.arguments[mapping.index]);
            if (argNamespace) namespaceByBinding.set(binding, argNamespace);
            else if (namespace) namespaceByBinding.set(binding, namespace);
          } else if (namespace) {
            namespaceByBinding.set(binding, namespace);
          }
        }
      }
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

    JSXText(path) {
      if (!options.detectHardcodedText) return;
      addHardcodedEntry(path.node.value, path.node.loc?.start);
    },

    StringLiteral(path) {
      if (!options.detectHardcodedText) return;
      if (isTranslationArgument(path, parsedFunctions, parsedNamespaceFunctions)) return;
      if (isTechnicalStringLiteral(path)) return;
      addHardcodedEntry(path.node.value, path.node.loc?.start);
    },
  });

  return {
    entries,
    file: options.file,
    count: entries.length,
  };
}

function resolveWrapperInfo(
  fromFile: string,
  importedFrom: Map<string, { source: string; imported: string }>,
  calleeName: string,
  parsedNamespaceFunctions: ParsedFunctionSpec[],
) {
  const imp = importedFrom.get(calleeName);
  if (!imp) return null;

  const resolvedFile = resolveModuleSpecifier(fromFile, imp.source);
  if (!resolvedFile) return null;

  return resolveWrapperHook(resolvedFile, imp.imported, parsedNamespaceFunctions);
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

function shouldIgnoreKey(key: string, ignoredWords: string[], ignoredPatterns: string[]): boolean {
  if (!key.trim()) return true;
  if (ignoredWords.includes(key)) return true;
  if (matchesAnyPattern(key, ignoredPatterns)) return true;
  return false;
}

function normalizeHardcodedText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function shouldIgnoreHardcodedText(
  value: string,
  ignoredWords: string[],
  ignoredPatterns: string[],
): boolean {
  if (!value.trim()) return true;
  if (ignoredWords.includes(value)) return true;
  if (matchesAnyPattern(value, ignoredPatterns)) return true;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value)) return true;
  if (/^[\w.-]+$/.test(value) && /[._-]/.test(value)) return true;
  if (/^[#./?&=:~@%+\w-]+$/.test(value) && /[#./?&=:~@%+]/.test(value)) return true;
  return false;
}

function isTranslationArgument(
  path: NodePath<StringLiteral>,
  parsedFunctions: ParsedFunctionSpec[],
  parsedNamespaceFunctions: ParsedFunctionSpec[],
): boolean {
  const parent = path.parent;
  if (parent.type === 'CallExpression' && parent.arguments[0] === path.node) {
    return [...parsedFunctions, ...parsedNamespaceFunctions].some((fn) =>
      matchesCallee(parent.callee, fn),
    );
  }

  if (parent.type === 'ObjectProperty' && parent.value === path.node) {
    const keyName =
      parent.key.type === 'Identifier'
        ? parent.key.name
        : parent.key.type === 'StringLiteral'
          ? parent.key.value
          : null;

    const call = path.findParent((parentPath) => parentPath.isCallExpression())?.node;
    if (keyName === 'namespace' && call?.type === 'CallExpression') {
      return parsedNamespaceFunctions.some((fn) => matchesCallee(call.callee, fn));
    }
  }

  return false;
}

function isTechnicalStringLiteral(path: NodePath<StringLiteral>): boolean {
  const parent = path.parent;

  if (
    parent.type === 'ImportDeclaration' ||
    parent.type === 'ExportAllDeclaration' ||
    parent.type === 'ExportNamedDeclaration' ||
    parent.type === 'Directive' ||
    parent.type === 'TSLiteralType'
  ) {
    return true;
  }

  if (parent.type === 'ObjectProperty' && parent.key === path.node) return true;
  if (parent.type === 'MemberExpression' && parent.property === path.node) return true;

  if (parent.type === 'JSXAttribute') {
    const attrName =
      parent.name.type === 'JSXIdentifier'
        ? parent.name.name
        : `${parent.name.namespace.name}:${parent.name.name.name}`;

    const visibleAttributes = new Set([
      'alt',
      'aria-label',
      'label',
      'placeholder',
      'title',
      'value',
    ]);

    return !visibleAttributes.has(attrName);
  }

  return false;
}

function applyNamespace(key: string, namespace: string | undefined): string {
  return namespace ? `${namespace}.${key}` : key;
}
