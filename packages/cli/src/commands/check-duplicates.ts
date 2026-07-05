import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  scanTranslationFiles,
  loadTranslationFile,
  detectDuplicateValues,
  detectDuplicateKeys,
} from '@ndnci/translify-core';
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';
import { writeReport } from '../ui/report-writer.js';

interface CheckDuplicatesOptions {
  output?: string;
}

export function registerCheckDuplicatesCommand(program: Command, logger: CliLogger): void {
  program
    .command('check-duplicates')
    .description(
      'Detect duplicate translation values (same text under different keys) and duplicate keys (same key declared twice in one file)',
    )
    .option('--output <file>', 'write the report to a file (.json or plain text)')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify check-duplicates
  ${c.brand('$')} translify check-duplicates --output report.json
`,
    )
    .action(makeAction(program, logger));
}

function makeAction(program: Command, logger: CliLogger) {
  return async (opts: CheckDuplicatesOptions) => {
    const { cwd, config: configPath } = program.opts<{
      cwd: string;
      config?: string;
    }>();

    const spinner = createSpinner('Scanning translation files…');

    try {
      const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });
      const translationPaths = await scanTranslationFiles(config, cwd);
      const translationFiles = translationPaths.map(loadTranslationFile);
      const duplicateValues = detectDuplicateValues(translationFiles);
      const duplicateKeys = detectDuplicateKeys(translationFiles);

      spinner.stop();

      if (opts.output) writeReport(opts.output, { duplicateValues, duplicateKeys });

      const total = duplicateValues.length + duplicateKeys.length;
      if (total === 0) {
        logger.success('No duplicate translation values or keys found');
        return;
      }

      if (duplicateKeys.length > 0) {
        logger.warn(
          `Found ${duplicateKeys.length} duplicate key${duplicateKeys.length !== 1 ? 's' : ''} (silently overwritten by JSON.parse)`,
        );
        logger.spacer();
        logger.section('Duplicate keys');

        for (const dup of duplicateKeys) {
          process.stdout.write(`\n  ${c.file(relativePath(dup.file, cwd))}\n`);
          process.stdout.write(`    ${c.cross} ${c.key(dup.key)} declared at:\n`);
          for (const occ of dup.occurrences) {
            process.stdout.write(`      ${c.dim(`line ${occ.line}, column ${occ.column}`)}\n`);
          }
        }
        logger.spacer();
      }

      if (duplicateValues.length > 0) {
        logger.warn(
          `Found ${duplicateValues.length} duplicate value${duplicateValues.length !== 1 ? 's' : ''}`,
        );
        logger.spacer();
        logger.section('Duplicate values');

        for (const dup of duplicateValues) {
          process.stdout.write(
            `\n  ${c.lang(`[${dup.language}]`)} ${c.dim(`"${dup.value.slice(0, 60)}"`)} \n`,
          );
          for (const key of dup.keys) {
            process.stdout.write(`    ${c.dot} ${c.key(key)}\n`);
          }
        }
        logger.spacer();
      }

      process.exit(1);
    } catch (err) {
      spinner.fail('Analysis failed');
      logger.error((err as Error).message);
      process.exit(1);
    }
  };
}
