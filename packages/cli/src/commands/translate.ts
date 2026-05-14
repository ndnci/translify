import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import { scanTranslationFiles, loadTranslationFile } from '@ndnci/translify-core';
import { createProvider, translateMissingKeys } from '@ndnci/translify-ai';
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';

export function registerTranslateCommand(program: Command, logger: CliLogger): void {
  program
    .command('translate')
    .description('Auto-translate missing keys using an AI provider (requires config)')
    .option('--locale <lang>', 'only translate a specific language (e.g. fr, de, pt-BR)')
    .option('--all', 'translate all keys, not just missing ones')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify translate
  ${c.brand('$')} translify translate --locale fr
  ${c.brand('$')} translify translate --locale fr --dry-run
  ${c.brand('$')} translify translate --all
`,
    )
    .action(async (opts: { locale?: string; all?: boolean }) => {
      const {
        cwd,
        config: configPath,
        dryRun,
        verbose,
      } = program.opts<{
        cwd: string;
        config?: string;
        dryRun: boolean;
        verbose: boolean;
      }>();

      const spinner = createSpinner('Loading config…');

      try {
        const { config } = await resolveConfig({ cwd, configPath });

        if (!config.ai_translation.enabled) {
          spinner.fail('AI translation is disabled');
          logger.warn(
            'Set ai_translation.enabled = true in your translify.config.ts to use this command.',
          );
          process.exit(1);
        }

        spinner.update('Initializing AI provider…');
        const provider = createProvider(config.ai_translation);

        spinner.update('Checking AI provider…');
        await provider.healthCheck();

        spinner.update('Loading translation files…');
        const translationPaths = await scanTranslationFiles(config, cwd);
        const translationFiles = translationPaths.map(loadTranslationFile);

        const targetLocales = opts.locale ? [opts.locale] : undefined;

        spinner.update('Translating…');
        const results = await translateMissingKeys(provider, {
          files: translationFiles,
          defaultLanguage: config.translations.default_language,
          targetLanguages: targetLocales,
          onlyMissing: !opts.all,
          batchSize: config.ai_translation.batch_size,
          dryRun,
        });

        const totalTranslated = results.reduce((s, r) => s + r.translatedKeys, 0);

        spinner.succeed(
          dryRun
            ? `[dry-run] Would translate ${totalTranslated} keys`
            : `Translated ${totalTranslated} keys via ${config.ai_translation.provider}`,
        );

        logger.spacer();
        logger.section('Translation results');

        for (const result of results) {
          const rel = relativePath(result.file, cwd);
          process.stdout.write(
            `  ${c.lang(result.language.padEnd(8))} ${c.file(rel)}  ` +
              `${c.success(`${result.translatedKeys} translated`)}  ` +
              `${c.dim(`${result.skippedKeys} skipped`)}\n`,
          );
        }

        logger.spacer();
      } catch (err) {
        spinner.fail('Translation failed');
        logger.error((err as Error).message);
        if (verbose) logger.debug(String(err));
        process.exit(1);
      }
    });
}
