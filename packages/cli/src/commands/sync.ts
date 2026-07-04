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
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';

export function registerSyncCommand(program: Command, logger: CliLogger): void {
  program
    .command('sync')
    .description('Sync translation files — add missing keys, keeping all languages aligned')
    .option('--empty', 'add missing keys with empty values instead of source-language copies')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify sync
  ${c.brand('$')} translify sync --dry-run
  ${c.brand('$')} translify sync --empty
`,
    )
    .action(async (opts: { empty?: boolean }) => {
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
          ignoredWords: config.extraction.ignored_words,
          ignoredPatterns: [
            ...config.extraction.ignored_patterns,
            ...config.extraction.custom_regex_patterns,
          ],
        });

        const extractedKeys = mergeExtractedKeys(extractResults);
        const translationFiles = translationPaths.map(loadTranslationFile);

        spinner.update('Syncing translation files…');

        const results = syncTranslationFiles({
          extractedKeys,
          files: translationFiles,
          defaultLanguage: config.translations.default_language,
          ...(opts.empty !== undefined && { useEmptyForMissing: opts.empty }),
          dryRun,
        });

        const totalAdded = results.reduce((s, r) => s + r.added.length, 0);

        spinner.succeed(
          dryRun
            ? `[dry-run] Would add ${totalAdded} keys across ${results.length} files`
            : `Synced ${results.length} language files (${totalAdded} keys added)`,
        );

        logger.spacer();
        logger.section('Sync results');

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
        spinner.fail('Sync failed');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}
