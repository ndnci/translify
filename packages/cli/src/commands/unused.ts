import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  scanFromConfig,
  scanTranslationFiles,
  extractFromFiles,
  mergeExtractedKeys,
  loadTranslationFile,
  detectUnusedKeys,
} from '@ndnci/translify-core';
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';

export function registerUnusedCommand(program: Command, logger: CliLogger): void {
  program
    .command('unused')
    .description('Detect translation keys defined in files but never used in source code')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify unused
  ${c.brand('$')} translify unused --verbose
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
        verbose: boolean;
      }>();

      const spinner = createSpinner('Analyzing…');

      try {
        const { config } = await resolveConfig({ cwd, configPath });

        const [scan, translationPaths] = await Promise.all([
          scanFromConfig(config, cwd),
          scanTranslationFiles(config, cwd),
        ]);

        const extractResults = await extractFromFiles(scan.files, {
          translationFunctions: config.extraction.translation_functions,
          ignoredWords: config.extraction.ignored_words,
          ignoredPatterns: [
            ...config.extraction.ignored_patterns,
            ...config.extraction.custom_regex_patterns,
          ],
        });

        const usedKeys = mergeExtractedKeys(extractResults);
        const translationFiles = translationPaths.map(loadTranslationFile);
        const unused = detectUnusedKeys(translationFiles, usedKeys);

        spinner.stop();

        if (unused.length === 0) {
          logger.success('No unused translation keys found');
          return;
        }

        logger.warn(`Found ${unused.length} unused key${unused.length !== 1 ? 's' : ''}`);
        logger.spacer();
        logger.section('Unused keys');

        // Group by file for readability
        const byFile = new Map<string, typeof unused>();
        for (const entry of unused) {
          const list = byFile.get(entry.file) ?? [];
          list.push(entry);
          byFile.set(entry.file, list);
        }

        for (const [file, entries] of byFile) {
          process.stdout.write(
            `\n  ${c.file(relativePath(file, cwd))} ${c.lang(`[${entries[0]!.language}]`)}\n`,
          );
          for (const entry of entries) {
            process.stdout.write(
              `    ${c.warn_sym} ${c.key(entry.key)}  ${c.dim(`"${entry.value.slice(0, 60)}"`)}\n`,
            );
          }
        }

        logger.spacer();
        logger.info(`Run ${c.brand('translify sync')} with manual review to remove stale keys.`);
        logger.spacer();

        process.exit(1); // Non-zero so CI can catch it
      } catch (err) {
        spinner.fail('Analysis failed');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}
