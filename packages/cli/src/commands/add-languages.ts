import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  loadTranslationFile,
  scanTranslationFiles,
  writeTranslationFile,
} from '@ndnci/translify-core';
import {
  relativePath,
  type TranslationRecord,
  type TranslationValue,
} from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';
import { createSpinner } from '../ui/spinner.js';

interface AddLanguagesOptions {
  empty?: boolean;
}

export function registerAddLanguagesCommand(program: Command, logger: CliLogger): void {
  program
    .command('add-languages <languages...>')
    .alias('add-locales')
    .description('Create translation files for one or more new languages')
    .option('--empty', 'create files with empty string values instead of copying source values')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify add-languages it de
  ${c.brand('$')} translify add-languages it de --empty
  ${c.brand('$')} translify add-languages it --dry-run
`,
    )
    .action(async (languages: string[], opts: AddLanguagesOptions) => {
      const {
        cwd,
        config: configPath,
        dryRun,
      } = program.opts<{
        cwd: string;
        config?: string;
        dryRun: boolean;
      }>();

      const spinner = createSpinner('Loading default-language files…');

      try {
        const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });
        const translationPaths = await scanTranslationFiles(config, cwd);
        const translationFiles = translationPaths.map(loadTranslationFile);
        const defaultFiles = translationFiles.filter(
          (file) => file.language === config.translations.default_language,
        );

        if (defaultFiles.length === 0) {
          throw new Error(
            `No files found for default language "${config.translations.default_language}"`,
          );
        }

        const created: string[] = [];
        const skipped: string[] = [];

        for (const language of languages) {
          for (const sourceFile of defaultFiles) {
            const targetPath = replaceLanguageInPath(
              sourceFile.path,
              config.translations.default_language,
              language,
            );

            if (existsSync(targetPath)) {
              skipped.push(targetPath);
              continue;
            }

            created.push(targetPath);
            if (!dryRun) {
              mkdirSync(dirname(targetPath), { recursive: true });
              writeTranslationFile(
                targetPath,
                opts.empty ? emptyTranslationValues(sourceFile.data) : sourceFile.data,
              );
            }
          }
        }

        spinner.succeed(
          dryRun
            ? `[dry-run] Would create ${created.length} files (${skipped.length} already exist)`
            : `Created ${created.length} files (${skipped.length} already existed)`,
        );

        logger.spacer();
        logger.section('Language files');
        for (const file of created) {
          process.stdout.write(`  ${c.success('+')} ${c.file(relativePath(file, cwd))}\n`);
        }
        for (const file of skipped) {
          process.stdout.write(
            `  ${c.dim('=')} ${c.file(relativePath(file, cwd))} ${c.dim('exists')}\n`,
          );
        }
        logger.spacer();
      } catch (err) {
        spinner.fail('Could not add languages');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}

function replaceLanguageInPath(filePath: string, fromLanguage: string, toLanguage: string): string {
  const parsed = parse(filePath);

  if (parsed.name === fromLanguage) {
    return join(parsed.dir, `${toLanguage}${parsed.ext}`);
  }

  const segments = filePath.split(/[\\/]/);
  const index = segments.findIndex((segment) => segment === fromLanguage);
  if (index >= 0) {
    segments[index] = toLanguage;
    return segments.join('/');
  }

  return join(parsed.dir, toLanguage, parsed.base);
}

function emptyTranslationValues(data: TranslationRecord): TranslationRecord {
  const result: TranslationRecord = {};

  for (const [key, value] of Object.entries(data)) {
    result[key] = emptyValue(value);
  }

  return result;
}

function emptyValue(value: TranslationValue): TranslationValue {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return emptyTranslationValues(value);
  }

  return '';
}
