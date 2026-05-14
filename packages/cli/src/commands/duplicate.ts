import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  scanTranslationFiles,
  loadTranslationFile,
  detectDuplicateValues,
} from '@ndnci/translify-core';
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';

export function registerDuplicateCommand(program: Command, logger: CliLogger): void {
  program
    .command('duplicate')
    .description('Detect translation entries with duplicate values in the same language file')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify duplicate
`,
    )
    .action(async () => {
      const { cwd, config: configPath } = program.opts<{
        cwd: string;
        config?: string;
      }>();

      const spinner = createSpinner('Scanning translation files…');

      try {
        const { config } = await resolveConfig({ cwd, configPath });
        const translationPaths = await scanTranslationFiles(config, cwd);
        const translationFiles = translationPaths.map(loadTranslationFile);
        const duplicates = detectDuplicateValues(translationFiles);

        spinner.stop();

        if (duplicates.length === 0) {
          logger.success('No duplicate translation values found');
          return;
        }

        logger.warn(
          `Found ${duplicates.length} duplicate value${duplicates.length !== 1 ? 's' : ''}`,
        );
        logger.spacer();
        logger.section('Duplicate values');

        for (const dup of duplicates) {
          process.stdout.write(
            `\n  ${c.lang(`[${dup.language}]`)} ${c.dim(`"${dup.value.slice(0, 60)}"`)} \n`,
          );
          for (const key of dup.keys) {
            process.stdout.write(`    ${c.dot} ${c.key(key)}\n`);
          }
        }

        logger.spacer();
        process.exit(1);
      } catch (err) {
        spinner.fail('Analysis failed');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}
