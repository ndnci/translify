import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import { scanFromConfig, extractFromFiles, mergeExtractedKeys } from '@ndnci/translify-core';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';

export function registerExtractCommand(program: Command, logger: CliLogger): void {
  program
    .command('extract')
    .description('Extract all translation keys used in your source code')
    .option('--no-summary', 'skip the summary table')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify extract
  ${c.brand('$')} translify extract --verbose
  ${c.brand('$')} translify extract --config ./config/translify.config.ts
`,
    )
    .action(async () => {
      const {
        cwd,
        config: configPath,
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
        spinner.update('Scanning source files…');

        const scan = await scanFromConfig(config, cwd);
        spinner.update(`Extracting keys from ${scan.files.length} files…`);

        const results = await extractFromFiles(scan.files, {
          translationFunctions: config.extraction.translation_functions,
          ignoredWords: config.extraction.ignored_words,
          ignoredPatterns: [
            ...config.extraction.ignored_patterns,
            ...config.extraction.custom_regex_patterns,
          ],
        });

        const uniqueKeys = mergeExtractedKeys(results);
        const totalEntries = results.reduce((s, r) => s + r.count, 0);

        spinner.succeed(
          `Extracted ${c.count(String(uniqueKeys.size))} unique keys from ${scan.files.length} files`,
        );

        logger.spacer();
        logger.section('Extraction summary');
        logger.kv('Source files scanned', String(scan.files.length));
        logger.kv('Total call sites', String(totalEntries));
        logger.kv('Unique keys', c.count(String(uniqueKeys.size)));
        logger.kv('Scan time', `${scan.durationMs}ms`);

        if (verbose) {
          logger.spacer();
          logger.section('Keys found');
          for (const key of [...uniqueKeys].sort()) {
            process.stdout.write(`  ${c.key(key)}\n`);
          }
        }

        logger.spacer();
      } catch (err) {
        spinner.fail('Extraction failed');
        logger.error((err as Error).message);
        if (verbose) logger.debug(String(err));
        process.exit(1);
      }
    });
}
