import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  scanTranslationFiles,
  loadTranslationFile,
  optimizeTranslationFiles,
} from '@ndnci/translify-core';
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';

export function registerOptimizeCommand(program: Command, logger: CliLogger): void {
  program
    .command('optimize')
    .description('Optimize translation files: sort keys, report empty entries')
    .option('--no-sort', 'skip alphabetical key sorting')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify optimize
  ${c.brand('$')} translify optimize --dry-run
  ${c.brand('$')} translify optimize --no-sort
`,
    )
    .action(async (opts: { sort: boolean }) => {
      const {
        cwd,
        config: configPath,
        dryRun,
      } = program.opts<{
        cwd: string;
        config?: string;
        dryRun: boolean;
      }>();

      const spinner = createSpinner('Loading translation files…');

      try {
        const { config } = await resolveConfig({ cwd, configPath });
        const translationPaths = await scanTranslationFiles(config, cwd);
        const translationFiles = translationPaths.map(loadTranslationFile);

        spinner.update('Optimizing…');

        const results = optimizeTranslationFiles({
          files: translationFiles,
          sortKeys: opts.sort,
          reportEmpty: true,
          dryRun,
        });

        spinner.succeed(
          dryRun
            ? `[dry-run] Would optimize ${results.length} files`
            : `Optimized ${results.length} files`,
        );

        logger.spacer();
        logger.section('Optimize results');

        for (const result of results) {
          const rel = relativePath(result.file, cwd);
          process.stdout.write(
            `  ${c.lang(result.language.padEnd(8))} ${c.file(rel)}  ` +
              `${c.dim(`${result.sortedKeys} keys`)}` +
              (result.emptyKeysFound > 0 ? `  ${c.warn(`${result.emptyKeysFound} empty`)}` : ''),
          );
          process.stdout.write('\n');
        }

        logger.spacer();
      } catch (err) {
        spinner.fail('Optimization failed');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}
