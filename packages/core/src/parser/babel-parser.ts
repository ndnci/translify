import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import type { File } from '@babel/types';
import { ParseError } from '@ndnci/translify-shared';

export type SupportedExtension =
  | '.ts'
  | '.tsx'
  | '.js'
  | '.jsx'
  | '.mts'
  | '.cts'
  | '.mjs'
  | '.cjs';

/**
 * Parses a source file into a Babel AST.
 *
 * Automatically selects the correct Babel plugins based on file extension:
 * - .ts/.mts/.cts → TypeScript
 * - .tsx → TypeScript + JSX
 * - .jsx → JSX
 * - .js/.mjs/.cjs → plain JavaScript
 *
 * @throws ParseError if the file cannot be parsed
 */
export function parseFile(filePath: string): File {
  let source: string;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch (cause) {
    throw new ParseError(filePath, 'Could not read file', cause);
  }

  return parseSource(source, filePath);
}

/**
 * Parses a source string into a Babel AST.
 * Accepts a `filePath` hint for error messages and plugin selection.
 *
 * @throws ParseError if the source cannot be parsed
 */
export function parseSource(source: string, filePath: string): File {
  const ext = getExtension(filePath);
  const plugins = getPluginsForExtension(ext);

  try {
    return parse(source, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins,
      errorRecovery: true, // Continue parsing even if there are non-fatal errors
    });
  } catch (cause) {
    throw new ParseError(
      filePath,
      cause instanceof Error ? cause.message : 'Unknown parse error',
      cause,
    );
  }
}

function getExtension(filePath: string): SupportedExtension {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tsx')) return '.tsx';
  if (lower.endsWith('.mts') || lower.endsWith('.cts')) return '.ts';
  if (lower.endsWith('.ts')) return '.ts';
  if (lower.endsWith('.jsx')) return '.jsx';
  if (lower.endsWith('.mjs') || lower.endsWith('.cjs')) return '.mjs';
  return '.js';
}

function getPluginsForExtension(ext: SupportedExtension): Parameters<typeof parse>[1]['plugins'] {
  const base: Parameters<typeof parse>[1]['plugins'] = [
    'optionalChaining',
    'nullishCoalescingOperator',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'decorators-legacy',
    'dynamicImport',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'importMeta',
    'logicalAssignment',
    'numericSeparator',
    'objectRestSpread',
    'optionalCatchBinding',
    'throwExpressions',
  ];

  if (ext === '.tsx') {
    return [...base, 'typescript', 'jsx'];
  }
  if (ext === '.ts' || ext === '.mts') {
    return [...base, 'typescript'];
  }
  if (ext === '.jsx') {
    return [...base, 'jsx'];
  }
  return base;
}
