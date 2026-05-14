import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  scanFromConfig,
  scanTranslationFiles,
  extractFromFiles,
  mergeExtractedKeys,
  loadTranslationFile,
  detectUnusedKeys,
  detectMissingKeys,
  detectDuplicateValues,
} from '@ndnci/translify-core';
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';

export function registerAuditCommand(program: Command, logger: CliLogger): void {
  program
    .command('audit')
    .description('Full i18n health audit — runs all checks in one pass')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify audit
  ${c.brand('$')} translify audit --verbose
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

      const spinner = createSpinner('Running audit…');

      try {
        const { config } = await resolveConfig({ cwd, configPath });

        const [scan, translationPaths] = await Promise.all([
          scanFromConfig(config, cwd),
          scanTranslationFiles(config, cwd),
        ]);

        spinner.update(`Extracting keys from ${scan.files.length} source files…`);

        const extractResults = await extractFromFiles(scan.files, {
          translationFunctions: config.extraction.translation_functions,
          ignoredWords: config.extraction.ignored_words,
          ignoredPatterns: [
            ...config.extraction.ignored_patterns,
            ...config.extraction.custom_regex_patterns,
          ],
        });

        const usedKeys = mergeExtractedKeys(extractResults);
        const allEntries = extractResults.flatMap((r) => r.entries);
        const translationFiles = translationPaths.map(loadTranslationFile);

        spinner.update('Running detection checks…');

        const [unusedKeys, missingKeys, duplicateValues] = [
          detectUnusedKeys(translationFiles, usedKeys),
          detectMissingKeys(translationFiles, allEntries),
          detectDuplicateValues(translationFiles),
        ];

        spinner.stop();

        const hasIssues =
          unusedKeys.length > 0 || missingKeys.length > 0 || duplicateValues.length > 0;

        // ── Header ──────────────────────────────────────────────────────────

        logger.spacer();
        process.stdout.write(
          `${c.brand('▸')} ${c.bold('Translify Audit')} ${c.dim(new Date().toISOString())}\n`,
        );
        logger.spacer();

        // ── Overview ────────────────────────────────────────────────────────

        logger.section('Overview');
        logger.kv('Source files', String(scan.files.length));
        logger.kv('Translation files', String(translationPaths.length));
        logger.kv('Unique keys used', String(usedKeys.size));

        // ── Results per check ───────────────────────────────────────────────

        const checks: Array<{ label: string; count: number }> = [
          { label: 'Missing keys', count: missingKeys.length },
          { label: 'Unused keys', count: unusedKeys.length },
          { label: 'Duplicate values', count: duplicateValues.length },
        ];

        logger.section('Checks');
        for (const check of checks) {
          const icon = check.count === 0 ? c.tick : c.cross;
          const countStr = check.count === 0 ? c.success('none') : c.error(String(check.count));
          process.stdout.write(`  ${icon} ${check.label.padEnd(20)} ${countStr}\n`);
        }

        // ── Details (verbose or if issues) ──────────────────────────────────

        if (missingKeys.length > 0) {
          logger.section('Missing keys');
          for (const k of missingKeys.slice(0, 20)) {
            process.stdout.write(
              `  ${c.cross} ${c.lang(`[${k.language}]`)} ${c.key(k.key)}  ${c.dim(relativePath(k.sourceFile, cwd) + ':' + k.sourceLine)}\n`,
            );
          }
          if (missingKeys.length > 20) {
            process.stdout.write(c.dim(`  … and ${missingKeys.length - 20} more\n`));
          }
        }

        if (unusedKeys.length > 0) {
          logger.section('Unused keys');
          for (const k of unusedKeys.slice(0, 20)) {
            process.stdout.write(`  ${c.warn_sym} ${c.lang(`[${k.language}]`)} ${c.key(k.key)}\n`);
          }
          if (unusedKeys.length > 20) {
            process.stdout.write(c.dim(`  … and ${unusedKeys.length - 20} more\n`));
          }
        }

        // ── Final verdict ───────────────────────────────────────────────────

        logger.spacer();
        if (hasIssues) {
          logger.warn('Audit found issues. Review the output above.');
        } else {
          logger.success('Audit passed — all i18n checks clean!');
        }
        logger.spacer();

        if (hasIssues) process.exit(1);
      } catch (err) {
        spinner.fail('Audit failed');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}
