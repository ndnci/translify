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
  detectDuplicateKeys,
  detectLocaleInconsistencies,
} from '@ndnci/translify-core';
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';
import { renderTable } from '../ui/table.js';
import { writeReport } from '../ui/report-writer.js';

interface AuditOptions {
  output?: string;
}

export function registerAuditCommand(program: Command, logger: CliLogger): void {
  program
    .command('audit')
    .description(
      'Full i18n health audit — runs every check in one pass (missing, unused, duplicates, locale consistency, hardcoded text)',
    )
    .option('--output <file>', 'write the report to a file (.json or plain text)')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify audit
  ${c.brand('$')} translify audit --verbose
  ${c.brand('$')} translify audit --output report.json
`,
    )
    .action(async (opts: AuditOptions) => {
      const { cwd, config: configPath } = program.opts<{
        cwd: string;
        config?: string;
        verbose: boolean;
      }>();

      const spinner = createSpinner('Running audit…');

      try {
        const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });

        const [scan, translationPaths] = await Promise.all([
          scanFromConfig(config, cwd),
          scanTranslationFiles(config, cwd),
        ]);

        spinner.update(`Extracting keys from ${scan.files.length} source files…`);

        const extractResults = await extractFromFiles(scan.files, {
          translationFunctions: config.extraction.translation_functions,
          namespaceFunctions: config.extraction.namespace_functions,
          ignoredWords: config.extraction.ignored_words,
          ignoredPatterns: [
            ...config.extraction.ignored_patterns,
            ...config.extraction.custom_regex_patterns,
          ],
          detectHardcodedText: true,
        });

        const allEntries = extractResults.flatMap((r) => r.entries);
        const translationEntries = allEntries.filter((entry) => entry.type === 'translation-call');
        const hardcodedText = allEntries.filter((entry) => entry.type === 'hardcoded-text');
        const usedKeys = mergeExtractedKeys(
          extractResults.map((result) => ({
            ...result,
            entries: result.entries.filter((entry) => entry.type === 'translation-call'),
          })),
        );
        const translationFiles = translationPaths.map(loadTranslationFile);

        spinner.update('Running detection checks…');

        const unusedKeys = detectUnusedKeys(translationFiles, usedKeys);
        const missingKeys = detectMissingKeys(translationFiles, translationEntries);
        const duplicateValues = detectDuplicateValues(translationFiles);
        const duplicateKeys = detectDuplicateKeys(translationFiles);
        const localeInconsistencies = detectLocaleInconsistencies(
          translationFiles,
          config.translations.default_language,
        );

        spinner.stop();

        const hasIssues =
          unusedKeys.length > 0 ||
          missingKeys.length > 0 ||
          duplicateValues.length > 0 ||
          duplicateKeys.length > 0 ||
          localeInconsistencies.length > 0 ||
          hardcodedText.length > 0;

        const issueCount =
          unusedKeys.length +
          missingKeys.length +
          duplicateValues.length +
          duplicateKeys.length +
          localeInconsistencies.length +
          hardcodedText.length;

        if (opts.output) {
          writeReport(opts.output, {
            timestamp: new Date().toISOString(),
            totalFiles: translationPaths.length,
            totalKeys: usedKeys.size,
            unusedKeys,
            missingKeys,
            duplicateValues,
            duplicateKeys,
            localeInconsistencies,
            hardcodedText,
          });
        }

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
          { label: 'Duplicate keys', count: duplicateKeys.length },
          { label: 'Locale inconsistencies', count: localeInconsistencies.length },
          { label: 'Hardcoded text', count: hardcodedText.length },
        ];

        logger.section('Checks');
        process.stdout.write(
          '\n' +
            renderTable(
              [
                { header: 'Check' },
                {
                  header: 'Issues',
                  color: (v) => (v.trim() === '0' ? c.success(v) : c.error(v)),
                },
              ],
              checks.map((check) => [check.label, String(check.count)]),
            ) +
            '\n',
        );

        // ── Details (issues only) ────────────────────────────────────────────

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

        if (duplicateKeys.length > 0) {
          logger.section('Duplicate keys');
          for (const dup of duplicateKeys.slice(0, 20)) {
            process.stdout.write(
              `  ${c.cross} ${c.key(dup.key)}  ${c.dim(relativePath(dup.file, cwd))}\n`,
            );
          }
          if (duplicateKeys.length > 20) {
            process.stdout.write(c.dim(`  … and ${duplicateKeys.length - 20} more\n`));
          }
        }

        if (duplicateValues.length > 0) {
          logger.section('Duplicate values');
          for (const dup of duplicateValues.slice(0, 20)) {
            process.stdout.write(
              `  ${c.warn_sym} ${c.lang(`[${dup.language}]`)} ${c.dim(`"${dup.value.slice(0, 60)}"`)}\n`,
            );
            for (const key of dup.keys.slice(0, 8)) {
              process.stdout.write(`    ${c.dot} ${c.key(key)}\n`);
            }
            if (dup.keys.length > 8) {
              process.stdout.write(c.dim(`    … and ${dup.keys.length - 8} more keys\n`));
            }
          }
          if (duplicateValues.length > 20) {
            process.stdout.write(c.dim(`  … and ${duplicateValues.length - 20} more\n`));
          }
        }

        if (localeInconsistencies.length > 0) {
          logger.section('Locale inconsistencies');
          for (const inc of localeInconsistencies.slice(0, 20)) {
            process.stdout.write(
              `  ${c.warn_sym} ${c.key(inc.key)}  ${c.dim(`missing in: ${inc.missingIn.join(', ')}`)}\n`,
            );
          }
          if (localeInconsistencies.length > 20) {
            process.stdout.write(c.dim(`  … and ${localeInconsistencies.length - 20} more\n`));
          }
        }

        if (hardcodedText.length > 0) {
          logger.section('Hardcoded text');
          for (const entry of hardcodedText.slice(0, 20)) {
            process.stdout.write(
              `  ${c.warn_sym} ${c.dim(`"${entry.key.slice(0, 80)}"`)}  ${c.dim(relativePath(entry.file, cwd) + ':' + entry.line)}\n`,
            );
          }
          if (hardcodedText.length > 20) {
            process.stdout.write(c.dim(`  … and ${hardcodedText.length - 20} more\n`));
          }
        }

        // ── Final verdict ───────────────────────────────────────────────────

        logger.spacer();
        if (hasIssues) {
          logger.warn(
            `Audit found ${issueCount} issue${issueCount !== 1 ? 's' : ''}. Review the output above.`,
          );
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
