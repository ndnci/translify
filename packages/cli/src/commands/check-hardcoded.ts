import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import { extractFromFiles, scanFromConfig } from '@ndnci/translify-core';
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';
import { createSpinner } from '../ui/spinner.js';
import { writeReport } from '../ui/report-writer.js';

interface CheckHardcodedOptions {
  output?: string;
}

export function registerCheckHardcodedCommand(program: Command, logger: CliLogger): void {
  program
    .command('check-hardcoded')
    .description('Detect user-facing text that is hardcoded in source files')
    .option('--output <file>', 'write the report to a file (.json or plain text)')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify check-hardcoded
  ${c.brand('$')} translify check-hardcoded --output report.json
`,
    )
    .action(async (opts: CheckHardcodedOptions) => {
      const { cwd, config: configPath } = program.opts<{
        cwd: string;
        config?: string;
      }>();

      const spinner = createSpinner('Scanning source files…');

      try {
        const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });
        const scan = await scanFromConfig(config, cwd);

        spinner.update(`Checking ${scan.files.length} source files…`);

        const results = await extractFromFiles(scan.files, {
          translationFunctions: config.extraction.translation_functions,
          namespaceFunctions: config.extraction.namespace_functions,
          ignoredWords: config.extraction.ignored_words,
          ignoredPatterns: [
            ...config.extraction.ignored_patterns,
            ...config.extraction.custom_regex_patterns,
          ],
          detectHardcodedText: true,
        });

        const hardcodedText = results
          .flatMap((result) => result.entries)
          .filter((entry) => entry.type === 'hardcoded-text');

        spinner.stop();

        if (opts.output) writeReport(opts.output, { hardcodedText });

        if (hardcodedText.length === 0) {
          logger.success('No hardcoded user-facing text found');
          return;
        }

        logger.warn(
          `Found ${hardcodedText.length} hardcoded text occurrence${hardcodedText.length !== 1 ? 's' : ''}`,
        );
        logger.spacer();
        logger.section('Hardcoded text');

        for (const entry of hardcodedText) {
          process.stdout.write(
            `  ${c.warn_sym} ${c.dim(`"${entry.key.slice(0, 80)}"`)}  ${c.dim(relativePath(entry.file, cwd) + ':' + entry.line)}\n`,
          );
        }

        logger.spacer();
        process.exit(1);
      } catch (err) {
        spinner.fail('Hardcoded text check failed');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}
