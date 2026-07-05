import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  addTranslationKeys,
  detectDuplicateKeys,
  detectLocaleInconsistencies,
  detectMissingKeys,
  detectUnusedKeys,
  extractFromFiles,
  loadTranslationFile,
  removeTranslationKeys,
  scanFromConfig,
  scanTranslationFiles,
  syncTranslationFiles,
  writeTranslationFile,
} from '@ndnci/translify-core';
import {
  deepMerge,
  flattenTranslations,
  type TranslationFile,
  type TranslationRecord,
} from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';
import { createSpinner } from '../ui/spinner.js';

type FixKind = 'missing' | 'unused' | 'duplicate-keys' | 'locale-consistency';

const SUPPORTED_FIXES: FixKind[] = ['missing', 'unused', 'duplicate-keys', 'locale-consistency'];

interface FixOptions {
  include?: string;
  exclude?: string;
  empty?: boolean;
}

export function registerFixCommand(program: Command, logger: CliLogger): void {
  const action = makeAction(program, logger);

  program
    .command('fix')
    .description('Fix deterministic audit issues (supports --dry-run, --include, --exclude)')
    .option('--include <checks>', 'comma-separated checks to fix (default: all supported)')
    .option('--exclude <checks>', 'comma-separated checks to skip')
    .option('--empty', 'use empty strings when adding missing keys')
    .addHelpText(
      'after',
      `
${c.dim('Supported checks:')} ${SUPPORTED_FIXES.join(', ')}

${c.dim('Examples:')}
  ${c.brand('$')} translify fix --dry-run
  ${c.brand('$')} translify fix --include missing,locale-consistency
  ${c.brand('$')} translify fix --exclude unused
`,
    )
    .action(action);

  program
    .command('audit-fix', { hidden: true })
    .option('--include <checks>')
    .option('--exclude <checks>')
    .option('--empty')
    .action(action);
}

function makeAction(program: Command, logger: CliLogger) {
  return async (opts: FixOptions) => {
    const {
      cwd,
      config: configPath,
      dryRun,
    } = program.opts<{
      cwd: string;
      config?: string;
      dryRun: boolean;
    }>();

    const spinner = createSpinner('Analyzing audit issues…');

    try {
      const selectedFixes = parseSelectedFixes(opts);
      const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });

      const [scan, translationPaths] = await Promise.all([
        scanFromConfig(config, cwd),
        scanTranslationFiles(config, cwd),
      ]);

      const extractResults = await extractFromFiles(scan.files, {
        translationFunctions: config.extraction.translation_functions,
        namespaceFunctions: config.extraction.namespace_functions,
        ignoredWords: config.extraction.ignored_words,
        ignoredPatterns: [
          ...config.extraction.ignored_patterns,
          ...config.extraction.custom_regex_patterns,
        ],
      });

      const translationEntries = extractResults
        .flatMap((result) => result.entries)
        .filter((entry) => entry.type === 'translation-call');
      const extractedKeys = new Set(translationEntries.map((entry) => entry.key));
      const translationFiles = translationPaths.map(loadTranslationFile);

      const missingKeys = detectMissingKeys(translationFiles, translationEntries);
      const unusedKeys = detectUnusedKeys(translationFiles, extractedKeys);
      const duplicateKeys = detectDuplicateKeys(translationFiles);
      const localeInconsistencies = detectLocaleInconsistencies(
        translationFiles,
        config.translations.default_language,
      );

      spinner.update('Applying fixes…');

      const summary: string[] = [];

      if (selectedFixes.has('missing')) {
        const results = syncTranslationFiles({
          extractedKeys,
          files: translationFiles,
          defaultLanguage: config.translations.default_language,
          ...(opts.empty !== undefined && { useEmptyForMissing: opts.empty }),
          dryRun,
        });
        const total = results.reduce((sum, result) => sum + result.added.length, 0);
        summary.push(`${total} missing key${total !== 1 ? 's' : ''}`);
      }

      if (selectedFixes.has('locale-consistency')) {
        const total = fixLocaleConsistency({
          files: translationFiles,
          defaultLanguage: config.translations.default_language,
          useEmpty: opts.empty ?? false,
          dryRun,
        });
        summary.push(`${total} locale gap${total !== 1 ? 's' : ''}`);
      }

      if (selectedFixes.has('unused')) {
        const byFile = new Map<string, string[]>();
        for (const unused of unusedKeys) {
          const keys = byFile.get(unused.file) ?? [];
          keys.push(unused.key);
          byFile.set(unused.file, keys);
        }

        if (!dryRun) {
          for (const [file, keys] of byFile) removeTranslationKeys(file, keys);
        }

        summary.push(`${unusedKeys.length} unused key${unusedKeys.length !== 1 ? 's' : ''}`);
      }

      if (selectedFixes.has('duplicate-keys')) {
        const filesWithDuplicates = new Set(duplicateKeys.map((dup) => dup.file));
        if (!dryRun) {
          for (const filePath of filesWithDuplicates) {
            const file = translationFiles.find((candidate) => candidate.path === filePath);
            if (file) writeTranslationFile(file.path, file.data);
          }
        }

        summary.push(
          `${duplicateKeys.length} duplicate key declaration${duplicateKeys.length !== 1 ? 's' : ''}`,
        );
      }

      spinner.succeed(
        dryRun ? `[dry-run] Would fix ${summary.join(', ')}` : `Fixed ${summary.join(', ')}`,
      );

      logger.spacer();
      logger.section('Fix summary');
      for (const item of summary) {
        process.stdout.write(`  ${c.success('✓')} ${item}\n`);
      }

      if (missingKeys.length + localeInconsistencies.length + unusedKeys.length > 0) {
        logger.spacer();
        logger.info(
          `Run ${c.brand('translify audit')} after fixing to review remaining manual issues like duplicate values or hardcoded text.`,
        );
      }
      logger.spacer();
    } catch (err) {
      spinner.fail('Fix failed');
      logger.error((err as Error).message);
      process.exit(1);
    }
  };
}

function parseSelectedFixes(opts: FixOptions): Set<FixKind> {
  const included = parseFixList(opts.include);
  const excluded = parseFixList(opts.exclude);
  const base = included.length > 0 ? included : SUPPORTED_FIXES;
  return new Set(base.filter((fix) => !excluded.includes(fix)));
}

function parseFixList(input: string | undefined): FixKind[] {
  if (!input) return [];

  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => (part === 'all' ? SUPPORTED_FIXES : [part]))
    .map((part) => {
      if (!SUPPORTED_FIXES.includes(part as FixKind)) {
        throw new Error(`Unsupported fix "${part}". Supported: ${SUPPORTED_FIXES.join(', ')}`);
      }
      return part as FixKind;
    });
}

function fixLocaleConsistency(options: {
  files: TranslationFile[];
  defaultLanguage: string;
  useEmpty: boolean;
  dryRun: boolean;
}): number {
  const filesByLanguage = groupFilesByLanguage(options.files);
  const defaultFiles = filesByLanguage.get(options.defaultLanguage) ?? [];
  const defaultData = defaultFiles.reduce<TranslationRecord>(
    (merged, file) => deepMerge(merged, file.data),
    {},
  );
  const defaultFlat = flattenTranslations(defaultData);
  const inconsistencies = detectLocaleInconsistencies(options.files, options.defaultLanguage);
  let fixed = 0;

  for (const inconsistency of inconsistencies) {
    for (const language of inconsistency.missingIn) {
      const languageFiles = filesByLanguage.get(language) ?? [];
      const target = resolveTargetFile(inconsistency.key, languageFiles, defaultFiles, language);
      const value = options.useEmpty ? '' : (defaultFlat[inconsistency.key] ?? '');
      fixed++;
      if (!options.dryRun) addTranslationKeys(target, { [inconsistency.key]: value });
    }
  }

  return fixed;
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

function resolveTargetFile(
  key: string,
  languageFiles: TranslationFile[],
  defaultFiles: TranslationFile[],
  language: string,
): string {
  const root = key.split('.')[0] ?? key;
  const existing = languageFiles.find((file) => Object.hasOwn(file.data, root));
  if (existing) return existing.path;

  const defaultFile =
    defaultFiles.find((file) => Object.hasOwn(file.data, root)) ?? defaultFiles[0];
  if (!defaultFile) return languageFiles[0]?.path ?? '';

  return defaultFile.path
    .replace(`/${defaultFile.language}/`, `/${language}/`)
    .replace(`/${defaultFile.language}.json`, `/${language}.json`);
}
