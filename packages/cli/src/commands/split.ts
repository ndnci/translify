import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import {
  loadTranslationFile,
  scanTranslationFiles,
  writeTranslationFile,
} from '@ndnci/translify-core';
import {
  flattenTranslations,
  relativePath,
  unflattenTranslations,
  type TranslationRecord,
  type TranslifyConfig,
} from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';
import { createSpinner } from '../ui/spinner.js';

interface SplitOptions {
  depth?: string;
  groups?: string;
  outputPattern?: string;
  keepSource?: boolean;
}

interface SplitGroup {
  name: string;
  match: string[];
}

export function registerSplitCommand(program: Command, logger: CliLogger): void {
  program
    .command('split')
    .alias('extract')
    .description('Split large locale JSON files into multiple files by context')
    .option('--depth <number>', 'dot-key depth used for default grouping', '1')
    .option(
      '--groups <groups>',
      'custom groups, e.g. "tools=tool,auth=auth,marketing=landing|pricing"',
    )
    .option('--output-pattern <pattern>', 'path pattern with {language} and {group}')
    .option('--keep-source', 'keep the original monolithic files after splitting')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify split --dry-run
  ${c.brand('$')} translify split --groups tools=tool,auth=auth
  ${c.brand('$')} translify split --output-pattern "messages/{language}/{group}.json"
`,
    )
    .action(async (opts: SplitOptions) => {
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
        const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });
        const translationPaths = await scanTranslationFiles(config, cwd);
        const translationFiles = translationPaths.map(loadTranslationFile);

        const depth = Number.parseInt(opts.depth ?? String(config.translations.split.depth), 10);
        if (!Number.isInteger(depth) || depth < 1) {
          throw new Error('--depth must be an integer greater than 0');
        }

        const groups = [
          ...normalizeConfigGroups(config.translations.split.groups),
          ...parseCliGroups(opts.groups),
        ];

        spinner.update(`Splitting ${translationFiles.length} translation files…`);

        const written: string[] = [];
        const removed: string[] = [];

        for (const file of translationFiles) {
          const outputPattern =
            opts.outputPattern ??
            config.translations.split.output_pattern ??
            inferOutputPattern(file.path, file.language, cwd);

          const grouped = splitRecord(file.data, {
            depth,
            groups,
          });

          const outputPaths = new Set<string>();
          for (const [group, data] of grouped) {
            const targetPath = resolveOutputPath(
              outputPattern
                .replaceAll('{language}', file.language)
                .replaceAll('{group}', slugify(group)),
              cwd,
            );
            outputPaths.add(targetPath);
            written.push(targetPath);

            if (!dryRun) {
              mkdirSync(dirname(targetPath), { recursive: true });
              writeTranslationFile(targetPath, data);
            }
          }

          if (!opts.keepSource && !outputPaths.has(file.path)) {
            removed.push(file.path);
            if (!dryRun && existsSync(file.path)) rmSync(file.path);
          }
        }

        spinner.succeed(
          dryRun
            ? `[dry-run] Would write ${written.length} files and remove ${removed.length} source files`
            : `Wrote ${written.length} files and removed ${removed.length} source files`,
        );

        logger.spacer();
        logger.section('Split results');
        for (const file of written.slice(0, 30)) {
          process.stdout.write(`  ${c.success('+')} ${c.file(relativePath(file, cwd))}\n`);
        }
        if (written.length > 30) {
          process.stdout.write(c.dim(`  … and ${written.length - 30} more written files\n`));
        }
        for (const file of removed.slice(0, 30)) {
          process.stdout.write(
            `  ${c.warn_sym} ${c.file(relativePath(file, cwd))} ${c.dim('removed')}\n`,
          );
        }
        if (removed.length > 30) {
          process.stdout.write(c.dim(`  … and ${removed.length - 30} more removed files\n`));
        }
        logger.spacer();
      } catch (err) {
        spinner.fail('Split failed');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}

function splitRecord(
  data: TranslationRecord,
  options: { depth: number; groups: SplitGroup[] },
): Map<string, TranslationRecord> {
  const flat = flattenTranslations(data);
  const groupedFlat = new Map<string, Record<string, string>>();

  for (const [key, value] of Object.entries(flat)) {
    const group = resolveGroupName(key, options);
    const entries = groupedFlat.get(group) ?? {};
    entries[key] = value;
    groupedFlat.set(group, entries);
  }

  const grouped = new Map<string, TranslationRecord>();
  for (const [group, entries] of groupedFlat) {
    grouped.set(group, unflattenTranslations(entries));
  }
  return grouped;
}

function resolveGroupName(key: string, options: { depth: number; groups: SplitGroup[] }): string {
  const topLevel = key.split('.')[0] ?? key;

  for (const group of options.groups) {
    if (group.match.some((matcher) => matchesGroup(topLevel, matcher))) {
      return group.name;
    }
  }

  return key.split('.').slice(0, options.depth).join('.');
}

function matchesGroup(value: string, matcher: string): boolean {
  try {
    return new RegExp(matcher, 'i').test(value);
  } catch {
    return value.toLowerCase().includes(matcher.toLowerCase());
  }
}

function normalizeConfigGroups(
  groups: TranslifyConfig['translations']['split']['groups'],
): SplitGroup[] {
  return groups.map((group) => {
    if (typeof group === 'string') return { name: group, match: [group] };
    return { name: group.name, match: group.match.length > 0 ? group.match : [group.name] };
  });
}

function parseCliGroups(input: string | undefined): SplitGroup[] {
  if (!input) return [];

  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, rawMatchers] = part.split('=');
      const match = rawMatchers ? rawMatchers.split('|').filter(Boolean) : [name!];
      return { name: name!, match };
    });
}

function inferOutputPattern(filePath: string, language: string, cwd: string): string {
  const parsed = parse(filePath);
  const filenameLanguage = parsed.name === language;

  if (filenameLanguage) {
    return join(parsed.dir, language, '{group}.json');
  }

  const relativeDir = relative(cwd, parsed.dir).split(/[\\/]/);
  const languageIndex = relativeDir.findIndex((segment) => segment === language);
  if (languageIndex >= 0) {
    const root = join(cwd, ...relativeDir.slice(0, languageIndex));
    return join(root, '{language}', '{group}.json');
  }

  return join(parsed.dir, '{language}', '{group}.json');
}

function resolveOutputPath(pathPattern: string, cwd: string): string {
  return isAbsolute(pathPattern) ? pathPattern : resolve(cwd, pathPattern);
}

function slugify(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
