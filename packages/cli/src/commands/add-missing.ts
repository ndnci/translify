import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  scanFromConfig,
  scanTranslationFiles,
  extractFromFiles,
  mergeExtractedKeys,
  loadTranslationFile,
  syncTranslationFiles,
} from '@ndnci/translify-core';
import { relativePath, type TranslationFile } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';

interface AddMissingOptions {
  empty?: boolean;
}

export function registerAddMissingCommand(program: Command, logger: CliLogger): void {
  program
    .command('add-missing')
    .description(
      'Add keys used in code but missing from translation files (writes files — use --dry-run to preview)',
    )
    .option('--empty', 'add missing keys with empty values instead of source-language copies')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify add-missing
  ${c.brand('$')} translify add-missing --dry-run
  ${c.brand('$')} translify add-missing --empty
`,
    )
    .action(makeAction(program, logger));
}

function makeAction(program: Command, logger: CliLogger) {
  return async (opts: AddMissingOptions) => {
    const {
      cwd,
      config: configPath,
      dryRun,
      verbose,
    } = program.opts<{
      cwd: string;
      config?: string;
      dryRun: boolean;
      verbose: boolean;
    }>();

    const spinner = createSpinner('Loading config…');

    try {
      const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });
      spinner.update('Scanning files…');

      const [scan, translationPaths] = await Promise.all([
        scanFromConfig(config, cwd),
        scanTranslationFiles(config, cwd),
      ]);

      if (translationPaths.length === 0) {
        spinner.fail('No translation files found');
        logger.warn(
          `Check your config: translations.files = ${JSON.stringify(config.translations.files)}`,
        );
        process.exit(1);
      }

      spinner.update(`Extracting keys from ${scan.files.length} source files…`);

      const extractResults = await extractFromFiles(scan.files, {
        translationFunctions: config.extraction.translation_functions,
        namespaceFunctions: config.extraction.namespace_functions,
        ignoredWords: config.extraction.ignored_words,
        ignoredPatterns: [
          ...config.extraction.ignored_patterns,
          ...config.extraction.custom_regex_patterns,
        ],
      });

      const extractedKeys = mergeExtractedKeys(extractResults);
      const translationFiles = translationPaths.map(loadTranslationFile);
      const defaultFiles = translationFiles.filter(
        (file) => file.language === config.translations.default_language,
      );

      spinner.update('Adding missing keys…');

      const results = syncTranslationFiles({
        extractedKeys,
        files: translationFiles,
        defaultLanguage: config.translations.default_language,
        ...(opts.empty !== undefined && { useEmptyForMissing: opts.empty }),
        resolveTargetFile: (key, language, files) =>
          resolveTargetFile(key, language, files, defaultFiles),
        dryRun,
      });

      const totalAdded = results.reduce((s, r) => s + r.added.length, 0);

      spinner.succeed(
        dryRun
          ? `[dry-run] Would add ${totalAdded} keys across ${results.length} files`
          : `Added ${totalAdded} key${totalAdded !== 1 ? 's' : ''} across ${results.length} files`,
      );

      logger.spacer();
      logger.section('Results');

      for (const result of results) {
        const rel = relativePath(result.file, cwd);
        if (result.added.length > 0) {
          process.stdout.write(
            `  ${c.lang(result.language.padEnd(8))} ${c.file(rel)}  ` +
              `${c.success(`+${result.added.length} added`)}\n`,
          );
          if (verbose) {
            for (const key of result.added) {
              process.stdout.write(`    ${c.dim('+')} ${c.key(key)}\n`);
            }
          }
        } else {
          process.stdout.write(
            `  ${c.lang(result.language.padEnd(8))} ${c.file(rel)}  ${c.dim('up to date')}\n`,
          );
        }
      }

      logger.spacer();
    } catch (err) {
      spinner.fail('Failed to add missing keys');
      logger.error((err as Error).message);
      process.exit(1);
    }
  };
}

function resolveTargetFile(
  key: string,
  language: string,
  languageFiles: TranslationFile[],
  defaultFiles: TranslationFile[],
): string {
  const root = key.split('.')[0] ?? key;
  const existing = languageFiles.find((file) => Object.hasOwn(file.data, root));
  if (existing) return existing.path;

  const defaultFile = defaultFiles.find((file) => Object.hasOwn(file.data, root));
  if (defaultFile) {
    return defaultFile.path
      .replace(`/${defaultFile.language}/`, `/${language}/`)
      .replace(`/${defaultFile.language}.json`, `/${language}.json`);
  }

  return languageFiles[0]?.path ?? '';
}
