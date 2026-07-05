import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, parse, relative, resolve } from 'node:path';
import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  addTranslationKeys,
  extractFromFiles,
  loadTranslationFile,
  scanFromConfig,
  scanTranslationFiles,
} from '@ndnci/translify-core';
import {
  deepMerge,
  flattenTranslations,
  relativePath,
  type ExtractionEntry,
  type TranslationFile,
  type TranslationRecord,
  type TranslifyConfig,
} from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';
import { createSpinner } from '../ui/spinner.js';

interface HardcodedFixOptions {
  function?: string;
  context?: string;
  empty?: boolean;
}

interface TranslatorInfo {
  variable: string;
  namespace?: string;
}

interface Replacement {
  file: string;
  start: number;
  end: number;
  value: string;
  key: string;
}

export function registerHardcodedFixCommand(program: Command, logger: CliLogger): void {
  program
    .command('hardcoded-fix')
    .description('Replace detected hardcoded text with i18n calls and add default translations')
    .option('--function <name>', 'translation function to call when no local translator is found')
    .option('--context <name>', 'force a translation context for generated keys')
    .option('--empty', 'add empty strings for non-default languages')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify hardcoded-fix --dry-run
  ${c.brand('$')} translify hardcoded-fix --function t
  ${c.brand('$')} translify hardcoded-fix --context MarketingPage
  ${c.brand('$')} translify hardcoded-fix --empty
`,
    )
    .action(async (opts: HardcodedFixOptions) => {
      const {
        cwd,
        config: configPath,
        dryRun,
      } = program.opts<{
        cwd: string;
        config?: string;
        dryRun: boolean;
      }>();

      const spinner = createSpinner('Scanning hardcoded text…');

      try {
        const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });
        const [scan, translationPaths] = await Promise.all([
          scanFromConfig(config, cwd),
          scanTranslationFiles(config, cwd),
        ]);

        const translationFiles = translationPaths.map(loadTranslationFile);
        const filesByLanguage = groupFilesByLanguage(translationFiles);
        const defaultFiles = translationFiles.filter(
          (file) => file.language === config.translations.default_language,
        );

        if (defaultFiles.length === 0) {
          throw new Error(
            `No files found for default language "${config.translations.default_language}"`,
          );
        }

        const extractResults = await extractFromFiles(scan.files, {
          translationFunctions: config.extraction.translation_functions,
          namespaceFunctions: config.extraction.namespace_functions,
          ignoredWords: config.extraction.ignored_words,
          ignoredPatterns: [
            ...config.extraction.ignored_patterns,
            ...config.extraction.custom_regex_patterns,
          ],
          detectHardcodedText: true,
        });

        const hardcoded = extractResults
          .flatMap((result) => result.entries)
          .filter(isReplaceableHardcoded);

        spinner.update(`Preparing ${hardcoded.length} replacements…`);

        const defaultFlat = flattenTranslations(
          defaultFiles.reduce<TranslationRecord>(
            (merged, file) => deepMerge(merged, file.data),
            {},
          ),
        );
        const existingValueToKey = new Map<string, string>();
        for (const [key, value] of Object.entries(defaultFlat)) {
          if (!existingValueToKey.has(value)) existingValueToKey.set(value, key);
        }

        const replacementsByFile = new Map<string, Replacement[]>();
        const additionsByFile = new Map<string, Record<string, string>>();
        const usedKeys = new Set(Object.keys(defaultFlat));
        let reused = 0;

        for (const entry of hardcoded) {
          const sourceText = entry.key;
          const fileText = readFileSync(entry.file, 'utf8');
          const translator = detectTranslator(fileText);
          const context = opts.context ?? translator.namespace ?? deriveContext(entry.file, cwd);
          const existingKey = existingValueToKey.get(sourceText);
          const key = existingKey ?? generateUniqueKey(context, sourceText, usedKeys);
          const callKey =
            translator.namespace && key.startsWith(`${translator.namespace}.`)
              ? key.slice(translator.namespace.length + 1)
              : key;
          const fn =
            translator.variable ||
            opts.function ||
            config.extraction.translation_functions[0] ||
            't';
          const call = `${fn}(${JSON.stringify(callKey)})`;
          const replacement = entry.hardcodedKind === 'string-literal' ? call : `{${call}}`;

          if (existingKey) {
            reused++;
          } else {
            usedKeys.add(key);
            existingValueToKey.set(sourceText, key);
            for (const [language, files] of filesByLanguage) {
              const targetFile = resolveTranslationTarget(key, files, config, cwd, language);
              const additions = additionsByFile.get(targetFile) ?? {};
              additions[key] =
                language === config.translations.default_language || !opts.empty ? sourceText : '';
              additionsByFile.set(targetFile, additions);
            }
          }

          const replacements = replacementsByFile.get(entry.file) ?? [];
          replacements.push({
            file: entry.file,
            start: entry.start,
            end: entry.end,
            value: replacement,
            key,
          });
          replacementsByFile.set(entry.file, replacements);
        }

        if (!dryRun) {
          for (const [file, replacements] of replacementsByFile) {
            writeFileSync(
              file,
              applyReplacements(readFileSync(file, 'utf8'), replacements),
              'utf8',
            );
          }

          for (const [file, additions] of additionsByFile) {
            addTranslationKeys(file, additions);
          }
        }

        const replacementCount = [...replacementsByFile.values()].reduce(
          (sum, replacements) => sum + replacements.length,
          0,
        );
        const addedCount = [...additionsByFile.values()].reduce(
          (sum, additions) => sum + Object.keys(additions).length,
          0,
        );

        spinner.succeed(
          dryRun
            ? `[dry-run] Would replace ${replacementCount} hardcoded text occurrence${replacementCount !== 1 ? 's' : ''}`
            : `Replaced ${replacementCount} hardcoded text occurrence${replacementCount !== 1 ? 's' : ''}`,
        );

        logger.spacer();
        logger.section('Hardcoded fix summary');
        logger.kv('Source files', String(replacementsByFile.size));
        logger.kv('Translations added', String(addedCount));
        logger.kv('Existing translations reused', String(reused));

        for (const [file, replacements] of [...replacementsByFile].slice(0, 20)) {
          process.stdout.write(
            `  ${c.file(relativePath(file, cwd))} ${c.success(`+${replacements.length}`)}\n`,
          );
          for (const replacement of replacements.slice(0, 5)) {
            process.stdout.write(`    ${c.dot} ${c.key(replacement.key)}\n`);
          }
          if (replacements.length > 5) {
            process.stdout.write(c.dim(`    … and ${replacements.length - 5} more\n`));
          }
        }
        if (replacementsByFile.size > 20) {
          process.stdout.write(c.dim(`  … and ${replacementsByFile.size - 20} more files\n`));
        }
        logger.spacer();
      } catch (err) {
        spinner.fail('Hardcoded fix failed');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}

function isReplaceableHardcoded(
  entry: ExtractionEntry,
): entry is ExtractionEntry & { start: number; end: number } {
  return (
    entry.type === 'hardcoded-text' &&
    typeof entry.start === 'number' &&
    typeof entry.end === 'number' &&
    !!entry.hardcodedKind
  );
}

function detectTranslator(source: string): TranslatorInfo {
  const match = source.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(([\s\S]*?)\)/,
  );

  if (!match) return { variable: '' };

  const args = match[2] ?? '';
  const namespace =
    args.match(/namespace\s*:\s*["'`]([^"'`]+)["'`]/)?.[1] ??
    args.match(/^\s*["'`]([^"'`]+)["'`]/)?.[1];

  return { variable: match[1]!, ...(namespace && { namespace }) };
}

function deriveContext(filePath: string, cwd: string): string {
  const parsed = parse(filePath);
  const relativeParts = relative(cwd, parsed.dir)
    .split(/[\\/]/)
    .filter((part) => part && !part.startsWith('[') && !part.startsWith('('));
  const stem = ['page', 'layout', 'index'].includes(parsed.name)
    ? (relativeParts.at(-1) ?? parsed.name)
    : parsed.name;
  const previous = relativeParts.at(-1);
  const parts = previous && previous !== stem ? [previous, stem] : [stem];
  return toPascalCase(parts.join('-')) || 'Translations';
}

function generateUniqueKey(context: string, text: string, usedKeys: Set<string>): string {
  const base = `${context}.${toCamelCase(text) || 'text'}`;
  let key = base;
  let index = 2;

  while (usedKeys.has(key)) {
    key = `${base}${index}`;
    index++;
  }

  return key;
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal ? pascal[0]!.toLowerCase() + pascal.slice(1) : '';
}

function toPascalCase(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function applyReplacements(source: string, replacements: Replacement[]): string {
  let result = source;
  for (const replacement of [...replacements].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, replacement.start) + replacement.value + result.slice(replacement.end);
  }
  return result;
}

function groupFilesByLanguage(files: TranslationFile[]): Map<string, TranslationFile[]> {
  const byLanguage = new Map<string, TranslationFile[]>();
  for (const file of files) {
    const list = byLanguage.get(file.language) ?? [];
    list.push(file);
    byLanguage.set(file.language, list);
  }
  return byLanguage;
}

function resolveTranslationTarget(
  key: string,
  files: TranslationFile[],
  config: TranslifyConfig,
  cwd: string,
  language: string,
): string {
  const root = key.split('.')[0] ?? key;
  const existing = files.find((file) => Object.hasOwn(file.data, root));
  if (existing) return existing.path;
  if (files.length === 1) return files[0]!.path;

  const outputPattern = config.translations.split.output_pattern;
  if (outputPattern) {
    const path = outputPattern
      .replaceAll('{language}', language)
      .replaceAll('{group}', slugify(root));
    return isAbsolute(path) ? path : resolve(cwd, path);
  }

  return files[0]!.path;
}

function slugify(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
