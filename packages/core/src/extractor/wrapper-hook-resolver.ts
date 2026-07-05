import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { parse as parseJsonc } from 'jsonc-parser';
import type { CallExpression, Function as BabelFunction, ObjectExpression } from '@babel/types';
import _traverse from '@babel/traverse';
import { parseFile } from '../parser/babel-parser.js';
import {
  type ParsedFunctionSpec,
  matchesCallee,
  extractStaticNamespace,
  extractNamespaceParamRef,
} from './ast-helpers.js';

// @babel/traverse uses a CJS default export that needs this interop in ESM context
const traverse =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: typeof _traverse }).default;

// ─── Types ────────────────────────────────────────────────────────────────────

export type PropertyNamespace =
  | { type: 'fixed'; namespace: string }
  | { type: 'param'; index: number };

export interface WrapperHookInfo {
  /** Returned property name -> where its namespace comes from */
  properties: Map<string, PropertyNamespace>;
}

// ─── tsconfig path-alias resolution ────────────────────────────────────────────

interface TsconfigPaths {
  baseUrl: string;
  paths: Record<string, string[]>;
}

const tsconfigCache = new Map<string, TsconfigPaths | null>();

function findTsconfigPaths(fromDir: string): TsconfigPaths | null {
  let dir = fromDir;
  for (;;) {
    const tsconfigPath = join(dir, 'tsconfig.json');
    if (existsSync(tsconfigPath)) {
      if (tsconfigCache.has(tsconfigPath)) return tsconfigCache.get(tsconfigPath)!;
      let result: TsconfigPaths | null;
      try {
        const raw = readFileSync(tsconfigPath, 'utf8');
        const json = parseJsonc(raw) as {
          compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
        };
        result = {
          baseUrl: resolvePath(dir, json.compilerOptions?.baseUrl ?? '.'),
          paths: json.compilerOptions?.paths ?? {},
        };
      } catch {
        result = null;
      }
      tsconfigCache.set(tsconfigPath, result);
      return result;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function resolveWithExtensions(base: string): string | null {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of SOURCE_EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of SOURCE_EXTENSIONS) {
    const indexPath = join(base, `index${ext}`);
    if (existsSync(indexPath)) return indexPath;
  }
  return null;
}

/**
 * Resolves an import specifier to an absolute file path, handling relative
 * imports and TS path aliases declared in the nearest `tsconfig.json`.
 * Returns null for bare package specifiers (node_modules) or anything it
 * can't confidently resolve — callers should treat that as "not a local
 * wrapper hook" and fall back to their default behavior.
 */
export function resolveModuleSpecifier(fromFile: string, specifier: string): string | null {
  const fromDir = dirname(fromFile);

  if (specifier.startsWith('.')) {
    return resolveWithExtensions(resolvePath(fromDir, specifier));
  }

  const tsconfig = findTsconfigPaths(fromDir);
  if (!tsconfig) return null;

  for (const [pattern, targets] of Object.entries(tsconfig.paths)) {
    const target = targets[0];
    if (!target) continue;

    if (pattern.endsWith('/*') && specifier.startsWith(pattern.slice(0, -1))) {
      const rest = specifier.slice(pattern.length - 1);
      return resolveWithExtensions(resolvePath(tsconfig.baseUrl, target.slice(0, -1) + rest));
    }
    if (pattern === specifier) {
      return resolveWithExtensions(resolvePath(tsconfig.baseUrl, target));
    }
  }

  return null;
}

// ─── Wrapper hook body analysis ────────────────────────────────────────────────

const wrapperCache = new Map<string, WrapperHookInfo | null>();

function getFunctionName(node: BabelFunction, parent: unknown): string | null {
  if (node.type === 'FunctionDeclaration' && node.id) return node.id.name;
  const parentNode = parent as { type?: string; id?: { type: string; name: string } };
  if (parentNode?.type === 'VariableDeclarator' && parentNode.id?.type === 'Identifier') {
    return parentNode.id.name;
  }
  return null;
}

function findReturnObject(node: BabelFunction): ObjectExpression | null {
  if (node.body.type === 'ObjectExpression') return node.body;
  if (node.body.type !== 'BlockStatement') return null;

  let found: ObjectExpression | null = null;
  for (const statement of node.body.body) {
    if (statement.type === 'ReturnStatement' && statement.argument?.type === 'ObjectExpression') {
      found = statement.argument;
      break;
    }
  }
  return found;
}

/**
 * Resolves a local (same-project) wrapper hook — a function that itself
 * calls one or more namespace-hook functions and returns them, e.g.:
 *
 *   function useFeatureI18n(featureNamespace) {
 *     const t = useTranslations(featureNamespace);
 *     const tc = useTranslations("Shared");
 *     return { t, tc };
 *   }
 *
 * — into a per-returned-property namespace map, so callers destructuring
 * `const { t, tc } = useFeatureI18n("WidgetPanel")` get the right namespace for
 * each property instead of assuming they all share the call's own argument.
 * Returns null if the file/function can't be found or doesn't match this
 * shape (fine — callers fall back to their default behavior).
 */
export function resolveWrapperHook(
  filePath: string,
  exportName: string,
  namespaceFunctionSpecs: ParsedFunctionSpec[],
): WrapperHookInfo | null {
  const cacheKey = `${filePath}::${exportName}`;
  if (wrapperCache.has(cacheKey)) return wrapperCache.get(cacheKey)!;

  let result: WrapperHookInfo | null = null;

  try {
    const ast = parseFile(filePath);

    traverse(ast, {
      Function(path) {
        if (result) return;
        if (getFunctionName(path.node, path.parent) !== exportName) return;

        const paramNames = path.node.params.map((p) => (p.type === 'Identifier' ? p.name : null));

        // Local bindings inside the hook: `const t = useTranslations(featureNamespace)`
        const localNamespace = new Map<string, PropertyNamespace>();

        path.traverse({
          VariableDeclarator(varPath) {
            const vnode = varPath.node;
            if (vnode.id.type !== 'Identifier' || !vnode.init) return;

            const init = vnode.init.type === 'AwaitExpression' ? vnode.init.argument : vnode.init;
            if (!init || init.type !== 'CallExpression') return;

            const matched = namespaceFunctionSpecs.find((fn) => matchesCallee(init.callee, fn));
            if (!matched) return;

            const mapping = resolveArgNamespace(init, paramNames);
            if (mapping) localNamespace.set(vnode.id.name, mapping);
          },
        });

        const returnObject = findReturnObject(path.node);
        if (!returnObject) return;

        const properties = new Map<string, PropertyNamespace>();
        for (const prop of returnObject.properties) {
          if (prop.type !== 'ObjectProperty' || prop.key.type !== 'Identifier') continue;

          if (prop.value.type === 'Identifier') {
            const local = localNamespace.get(prop.value.name);
            if (local) properties.set(prop.key.name, local);
          } else if (prop.value.type === 'CallExpression') {
            const matched = namespaceFunctionSpecs.find((fn) =>
              matchesCallee((prop.value as CallExpression).callee, fn),
            );
            if (matched) {
              const mapping = resolveArgNamespace(prop.value as CallExpression, paramNames);
              if (mapping) properties.set(prop.key.name, mapping);
            }
          }
        }

        if (properties.size > 0) {
          result = { properties };
          path.stop();
        }
      },
    });
  } catch {
    result = null;
  }

  wrapperCache.set(cacheKey, result);
  return result;
}

function resolveArgNamespace(
  call: CallExpression,
  paramNames: (string | null)[],
): PropertyNamespace | undefined {
  const arg = call.arguments[0];
  const fixed = extractStaticNamespace(arg);
  if (fixed) return { type: 'fixed', namespace: fixed };

  const paramRef = extractNamespaceParamRef(arg);
  if (paramRef) {
    const index = paramNames.indexOf(paramRef);
    if (index !== -1) return { type: 'param', index };
  }

  return undefined;
}
