import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  scanFromConfig,
  scanTranslationFiles,
  extractFromFiles,
  loadTranslationFile,
  detectMissingKeys,
} from '@ndnci/translify-core';
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';

export function registerMissingCommand(program: Command, logger: CliLogger): void {
  program
    .command('missing')
    .description('Detect translation keys used in code but missing from translation files')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify missing
  ${c.brand('$')} translify missing --verbose
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

        const allEntries = extractResults.flatMap((r) => r.entries);
        const translationFiles = translationPaths.map(loadTranslationFile);
        const missing = detectMissingKeys(translationFiles, allEntries);

        spinner.stop();

        if (missing.length === 0) {
          logger.success('No missing translation keys found');
          return;
        }

        logger.warn(`Found ${missing.length} missing key${missing.length !== 1 ? 's' : ''}`);
        logger.spacer();
        logger.section('Missing keys');

        const byLanguage = new Map<string, typeof missing>();
        for (const entry of missing) {
          const list = byLanguage.get(entry.language) ?? [];
          list.push(entry);
          byLanguage.set(entry.language, list);
        }

        for (const [lang, entries] of byLanguage) {
          process.stdout.write(
            `\n  ${c.lang(`[${lang}]`)} ${c.file(relativePath(entries[0]!.file, cwd))}\n`,
          );
          for (const entry of entries) {
            process.stdout.write(
              `    ${c.cross} ${c.key(entry.key)}` +
                `  ${c.dim(`${relativePath(entry.sourceFile, cwd)}:${entry.sourceLine}`)}\n`,
            );
          }
        }

        logger.spacer();
        logger.info(`Run ${c.brand('translify sync')} to add the missing keys.`);
        logger.spacer();

        process.exit(1);
      } catch (err) {
        spinner.fail('Analysis failed');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}
