import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  scanTranslationFiles,
  loadTranslationFile,
  detectLocaleInconsistencies,
} from '@ndnci/translify-core';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';
import { renderTable } from '../ui/table.js';
import { writeReport } from '../ui/report-writer.js';

interface CheckConsistencyOptions {
  output?: string;
}

export function registerCheckConsistencyCommand(program: Command, logger: CliLogger): void {
  program
    .command('check-consistency')
    .description(
      'Detect keys that are not consistently mirrored across every locale (present in one language, missing in another)',
    )
    .option('--output <file>', 'write the report to a file (.json or plain text)')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify check-consistency
  ${c.brand('$')} translify check-consistency --output report.json
`,
    )
    .action(async (opts: CheckConsistencyOptions) => {
      const { cwd, config: configPath } = program.opts<{
        cwd: string;
        config?: string;
      }>();

      const spinner = createSpinner('Scanning translation files…');

      try {
        const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });
        const translationPaths = await scanTranslationFiles(config, cwd);
        const translationFiles = translationPaths.map(loadTranslationFile);
        const inconsistencies = detectLocaleInconsistencies(
          translationFiles,
          config.translations.default_language,
        );

        spinner.stop();

        if (opts.output) writeReport(opts.output, { localeInconsistencies: inconsistencies });

        if (inconsistencies.length === 0) {
          logger.success('All locales are consistent — every key is mirrored everywhere');
          return;
        }

        logger.warn(
          `Found ${inconsistencies.length} inconsistent key${inconsistencies.length !== 1 ? 's' : ''}`,
        );
        logger.spacer();
        logger.section('Locale inconsistencies');
        process.stdout.write(
          '\n' +
            renderTable(
              [
                { header: 'Key', color: c.key },
                { header: 'Present in' },
                { header: 'Missing in', color: c.warn },
              ],
              inconsistencies.map((r) => [r.key, r.presentIn.join(', '), r.missingIn.join(', ')]),
            ) +
            '\n',
        );

        logger.spacer();
        logger.info(`Run ${c.brand('translify add-missing')} to fill in the missing keys.`);
        logger.spacer();

        process.exit(1);
      } catch (err) {
        spinner.fail('Analysis failed');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}
