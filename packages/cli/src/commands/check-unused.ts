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
import { writeReport } from '../ui/report-writer.js';

interface CheckUnusedOptions {
  output?: string;
}

export function registerCheckUnusedCommand(program: Command, logger: CliLogger): void {
  const action = makeAction(program, logger);

  program
    .command('check-unused')
    .description('Detect translation keys defined in files but never used in source code')
    .option('--output <file>', 'write the report to a file (.json or plain text)')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify check-unused
  ${c.brand('$')} translify check-unused --verbose
  ${c.brand('$')} translify check-unused --output report.json
`,
    )
    .action(action);

  program
    .command('unused', { hidden: true })
    .option('--output <file>')
    .action((opts: CheckUnusedOptions) => {
      logger.warn(
        `${c.bold('translify unused')} is deprecated, use ${c.brand('translify check-unused')} instead.`,
      );
      return action(opts);
    });
}

function makeAction(program: Command, logger: CliLogger) {
  return async (opts: CheckUnusedOptions) => {
    const { cwd, config: configPath } = program.opts<{
      cwd: string;
      config?: string;
      verbose: boolean;
    }>();

    const spinner = createSpinner('Analyzing…');

    try {
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

      const usedKeys = mergeExtractedKeys(extractResults);
      const translationFiles = translationPaths.map(loadTranslationFile);
      const unused = detectUnusedKeys(translationFiles, usedKeys);

      spinner.stop();

      if (opts.output) writeReport(opts.output, { unusedKeys: unused });

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
      logger.info(`Review manually, then remove stale keys from your translation files.`);
      logger.spacer();

      process.exit(1); // Non-zero so CI can catch it
    } catch (err) {
      spinner.fail('Analysis failed');
      logger.error((err as Error).message);
      process.exit(1);
    }
  };
}
