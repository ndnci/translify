import type { Command } from 'commander';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { resolveConfig } from '@ndnci/translify-config';
import { scanTranslationFiles, loadTranslationFile } from '@ndnci/translify-core';
import {
  createProvider,
  translateMissingKeys,
  type TranslateProgressEvent,
  type TranslateProgressFile,
} from '@ndnci/translify-ai';
import { relativePath } from '@ndnci/translify-shared';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';

export function registerTranslateCommand(program: Command, logger: CliLogger): void {
  program
    .command('translate')
    .description('Auto-translate missing keys using an AI provider (requires config)')
    .option('--locale <lang>', 'only translate a specific language (e.g. fr, de, pt-BR)')
    .option(
      '--file <path>',
      'only translate specific translation files (repeat or comma-separate)',
      collectFiles,
    )
    .option('--all', 'translate all keys, not just missing ones')
    .option('--no-details', 'use the compact spinner-only progress output')
    .option('--resume', 'resume a saved translate checkpoint without prompting')
    .option('--restart', 'discard any saved translate checkpoint and start fresh')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify translate
  ${c.brand('$')} translify translate --locale fr
  ${c.brand('$')} translify translate --file messages/fr/common.json
  ${c.brand('$')} translify translate --file messages/fr/common.json --file messages/fr/legal.json
  ${c.brand('$')} translify translate --file messages/fr/common.json,messages/fr/legal.json
  ${c.brand('$')} translify translate --locale fr --dry-run
  ${c.brand('$')} translify translate --all
  ${c.brand('$')} translify translate --no-details
  ${c.brand('$')} translify translate --resume
  ${c.brand('$')} translify translate --restart
`,
    )
    .action(
      async (opts: {
        locale?: string;
        file?: string[];
        all?: boolean;
        details?: boolean;
        resume?: boolean;
        restart?: boolean;
      }) => {
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
        let spinnerActive = true;
        let progress: TranslationProgressRenderer | undefined;

        try {
          const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });

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
          const targetFiles = opts.file?.length
            ? resolveRequestedTranslationFiles(opts.file, translationFiles, cwd)
            : undefined;
          const showDetails = opts.details !== false;
          const checkpointPath = join(cwd, '.translify', 'translate-checkpoint.json');
          const checkpointSignature = createTranslateCheckpointSignature({
            provider: config.ai_translation.provider,
            model: config.ai_translation.model,
            defaultLanguage: config.translations.default_language,
            targetLocales,
            targetFiles,
            onlyMissing: !opts.all,
            batchSize: config.ai_translation.batch_size,
            valuesOnly: config.ai_translation.values_only,
            verify: config.ai_translation.verify,
            verifyModel: config.ai_translation.verify_model,
            translationFiles,
          });
          const resumeCheckpoint = dryRun
            ? false
            : await resolveCheckpointResume({
                checkpointPath,
                checkpointSignature,
                restart: opts.restart === true,
                resume: opts.resume === true,
                logger,
                stopSpinner: () => {
                  if (spinnerActive) {
                    spinner.stop();
                    spinnerActive = false;
                  }
                },
              });

          spinner.update('Translating…');
          if (showDetails) {
            spinner.stop();
            spinnerActive = false;
            progress = new TranslationProgressRenderer(cwd);
          }

          const results = await translateMissingKeys(provider, {
            files: translationFiles,
            defaultLanguage: config.translations.default_language,
            ...(targetLocales && { targetLanguages: targetLocales }),
            ...(targetFiles && { targetFiles }),
            onlyMissing: !opts.all,
            batchSize: config.ai_translation.batch_size,
            valuesOnly: config.ai_translation.values_only,
            verify: config.ai_translation.verify,
            ...(config.ai_translation.verify_model && {
              verifyModel: config.ai_translation.verify_model,
            }),
            dryRun,
            ...(progress && { onProgress: progress.handle }),
            ...(!dryRun && {
              checkpoint: {
                path: checkpointPath,
                signature: checkpointSignature,
                resume: resumeCheckpoint,
              },
            }),
          });

          const totalTranslated = results.reduce((s, r) => s + r.translatedKeys, 0);
          const totalPromptTokens = results.reduce((s, r) => s + (r.usage?.promptTokens ?? 0), 0);
          const totalCompletionTokens = results.reduce(
            (s, r) => s + (r.usage?.completionTokens ?? 0),
            0,
          );
          const totalTokens = results.reduce((s, r) => s + (r.usage?.totalTokens ?? 0), 0);
          const totalCost = results.reduce((s, r) => s + (r.usage?.costUsd ?? 0), 0);
          const hasUsage = results.some((r) => r.usage);
          const hasCost = results.some((r) => r.usage?.costUsd !== undefined);

          progress?.finish();

          const successMessage = dryRun
            ? `[dry-run] Would translate ${totalTranslated} keys`
            : `Translated ${totalTranslated} keys via ${config.ai_translation.provider}`;

          if (spinnerActive) {
            spinner.succeed(successMessage);
          } else {
            logger.success(successMessage);
          }

          logger.spacer();
          logger.section('Translation results');

          for (const result of results) {
            const rel = relativePath(result.file, cwd);
            process.stdout.write(
              `  ${c.lang(result.language.padEnd(8))} ${c.file(rel)}  ` +
                `${c.success(`${result.translatedKeys} translated`)}  ` +
                `${c.dim(`${result.skippedKeys} skipped`)}` +
                formatUsage(result.usage) +
                '\n',
            );
          }

          if (hasUsage) {
            logger.spacer();
            logger.section('AI usage');
            process.stdout.write(
              `  ${c.dim('Prompt tokens:')} ${totalPromptTokens.toLocaleString()}\n` +
                `  ${c.dim('Completion tokens:')} ${totalCompletionTokens.toLocaleString()}\n` +
                `  ${c.dim('Total tokens:')} ${totalTokens.toLocaleString()}\n`,
            );
            if (hasCost) {
              process.stdout.write(`  ${c.dim('Total cost:')} ${formatUsd(totalCost)}\n`);
            }
          }

          logger.spacer();
        } catch (err) {
          progress?.finish();
          if (spinnerActive) {
            spinner.fail('Translation failed');
          } else {
            logger.error('Translation failed');
          }
          logger.error((err as Error).message);
          if (verbose) logger.debug(String(err));
          process.exit(1);
        }
      },
    );
}

interface TranslateCheckpointMetadata {
  version?: number;
  signature?: string;
  updatedAt?: string;
  files?: Record<string, { translations?: Record<string, string>; totalKeys?: number }>;
}

interface CheckpointResumeOptions {
  checkpointPath: string;
  checkpointSignature: string;
  restart: boolean;
  resume: boolean;
  logger: CliLogger;
  stopSpinner(): void;
}

async function resolveCheckpointResume(options: CheckpointResumeOptions): Promise<boolean> {
  if (!existsSync(options.checkpointPath)) return false;

  if (options.restart) {
    options.stopSpinner();
    unlinkSync(options.checkpointPath);
    options.logger.info('Discarded saved translate checkpoint.');
    return false;
  }

  const checkpoint = readCheckpointMetadata(options.checkpointPath);
  if (!checkpoint || checkpoint.signature !== options.checkpointSignature) {
    options.stopSpinner();
    options.logger.warn(
      'Found a saved translate checkpoint for a different command/config. Starting fresh.',
    );
    return false;
  }

  if (options.resume) return true;

  const summary = checkpointSummary(checkpoint);
  if (!process.stdin.isTTY) {
    options.stopSpinner();
    options.logger.info(`Resuming saved translate checkpoint${summary}.`);
    return true;
  }

  options.stopSpinner();
  return promptYesNo(`Resume saved translate checkpoint${summary}?`, true);
}

function readCheckpointMetadata(path: string): TranslateCheckpointMetadata | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as TranslateCheckpointMetadata;
  } catch {
    return undefined;
  }
}

function checkpointSummary(checkpoint: TranslateCheckpointMetadata): string {
  const files = Object.values(checkpoint.files ?? {});
  const translated = files.reduce(
    (sum, file) => sum + Object.keys(file.translations ?? {}).length,
    0,
  );
  const total = files.reduce((sum, file) => sum + (file.totalKeys ?? 0), 0);
  const count = total > 0 ? ` (${translated.toLocaleString()}/${total.toLocaleString()} keys)` : '';
  const updatedAt = checkpoint.updatedAt ? ` from ${checkpoint.updatedAt}` : '';
  return `${count}${updatedAt}`;
}

async function promptYesNo(question: string, defaultYes: boolean): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const suffix = defaultYes ? '[Y/n]' : '[y/N]';
    const answer = (await rl.question(`${question} ${suffix} `)).trim().toLowerCase();
    if (!answer) return defaultYes;
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

function createTranslateCheckpointSignature(input: {
  provider: string;
  model: string;
  defaultLanguage: string;
  targetLocales: string[] | undefined;
  targetFiles: string[] | undefined;
  onlyMissing: boolean;
  batchSize: number;
  valuesOnly: boolean;
  verify: boolean;
  verifyModel: string | undefined;
  translationFiles: ReturnType<typeof loadTranslationFile>[];
}): string {
  const referenceFiles = input.translationFiles
    .filter((file) => file.language === input.defaultLanguage)
    .map((file) => ({ path: file.path, data: file.data }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const scannedTargetFiles = input.translationFiles
    .filter((file) => file.language !== input.defaultLanguage)
    .map((file) => ({ language: file.language, path: file.path }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return createHash('sha256')
    .update(
      JSON.stringify({
        provider: input.provider,
        model: input.model,
        defaultLanguage: input.defaultLanguage,
        targetLocales: input.targetLocales ?? null,
        targetFiles: input.targetFiles ?? null,
        onlyMissing: input.onlyMissing,
        batchSize: input.batchSize,
        valuesOnly: input.valuesOnly,
        verify: input.verify,
        verifyModel: input.verifyModel ?? null,
        referenceFiles,
        scannedTargetFiles,
      }),
    )
    .digest('hex');
}

function collectFiles(value: string, previous: string[] = []): string[] {
  return [
    ...previous,
    ...value
      .split(',')
      .map((file) => file.trim())
      .filter(Boolean),
  ];
}

function resolveRequestedTranslationFiles(
  requestedFiles: string[],
  translationFiles: ReturnType<typeof loadTranslationFile>[],
  cwd: string,
): string[] {
  const byPath = new Map(
    translationFiles.flatMap((file) => {
      const absolute = normalizePath(file.path);
      const relative = normalizePath(relativePath(file.path, cwd));
      return [
        [absolute, file.path],
        [relative, file.path],
      ] as const;
    }),
  );

  const resolved = requestedFiles.map((file) => {
    const normalized = normalizePath(file);
    const absolute = normalizePath(resolve(cwd, file));
    return byPath.get(normalized) ?? byPath.get(absolute);
  });

  const missing = requestedFiles.filter((_, index) => !resolved[index]);
  if (missing.length > 0) {
    throw new Error(
      `Translation file not found in configured translations.files: ${missing.join(', ')}`,
    );
  }

  return [...new Set(resolved.filter((file): file is string => file !== undefined))];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

interface DisplayProgressFile extends TranslateProgressFile {
  relativeFile: string;
}

class TranslationProgressRenderer {
  private readonly files = new Map<string, DisplayProgressFile>();
  private readonly interactive = Boolean(process.stderr.isTTY && !process.env.CI);
  private lineCount = 0;
  private started = false;

  constructor(private readonly cwd: string) {
    this.handle = this.handle.bind(this);
  }

  handle(event: TranslateProgressEvent): void {
    if (event.type === 'start') {
      this.started = true;
      this.files.clear();
      for (const file of event.files) {
        this.files.set(file.file, this.toDisplayFile(file));
      }
      this.render();
      return;
    }

    if ('file' in event) {
      this.files.set(event.file.file, this.toDisplayFile(event.file));
      if (this.interactive) {
        this.render();
      } else if (event.type === 'file-complete') {
        this.writeStaticFileComplete(event.file);
      }
      return;
    }

    if (event.type === 'complete') {
      for (const file of event.files) {
        this.files.set(file.file, this.toDisplayFile(file));
      }
      this.render();
    }
  }

  finish(): void {
    if (!this.started) return;
    if (this.interactive && this.lineCount > 0) {
      process.stderr.write('\n');
    }
    this.lineCount = 0;
  }

  private toDisplayFile(file: TranslateProgressFile): DisplayProgressFile {
    return {
      ...file,
      relativeFile: relativePath(file.file, this.cwd),
    };
  }

  private render(): void {
    const lines = this.renderLines();

    if (this.interactive && this.lineCount > 0) {
      process.stderr.write(`\x1b[${this.lineCount}A\x1b[J`);
    }

    process.stderr.write(`${lines.join('\n')}\n`);
    this.lineCount = this.interactive ? lines.length : 0;
  }

  private renderLines(): string[] {
    const files = [...this.files.values()];
    const total = files.reduce((sum, file) => sum + file.totalKeys, 0);
    const translated = files.reduce((sum, file) => sum + file.translatedKeys, 0);
    const remaining = Math.max(total - translated, 0);
    const lines = [
      `${c.brand('▸')} ${c.bold('Translation progress')} ${c.dim(
        `${translated.toLocaleString()}/${total.toLocaleString()} translated, ${remaining.toLocaleString()} remaining`,
      )}`,
    ];

    for (const [language, languageFiles] of groupProgressFiles(files)) {
      lines.push(`${c.lang(language.toUpperCase())}:`);
      for (const file of languageFiles) {
        lines.push(this.renderFileLine(file));
      }
    }

    return lines;
  }

  private renderFileLine(file: DisplayProgressFile): string {
    const columns = process.stderr.columns ?? 100;
    const pathWidth = Math.max(24, Math.min(56, columns - 48));
    const label = padRight(truncateMiddle(file.relativeFile, pathWidth), pathWidth);
    const count = `(${file.translatedKeys.toLocaleString()}/${file.totalKeys.toLocaleString()})`;

    return `  - ${c.file(label)} ${progressBar(file.translatedKeys, file.totalKeys)} ${c.dim(
      count,
    )}`;
  }

  private writeStaticFileComplete(file: TranslateProgressFile): void {
    const displayFile = this.toDisplayFile(file);
    process.stderr.write(
      `  ${c.tick} ${c.lang(displayFile.language.toUpperCase())} ${c.file(
        displayFile.relativeFile,
      )} ${c.dim(
        `(${displayFile.translatedKeys.toLocaleString()}/${displayFile.totalKeys.toLocaleString()})`,
      )}\n`,
    );
  }
}

function groupProgressFiles(files: DisplayProgressFile[]): Array<[string, DisplayProgressFile[]]> {
  const groups = new Map<string, DisplayProgressFile[]>();
  for (const file of files) {
    const group = groups.get(file.language) ?? [];
    group.push(file);
    groups.set(file.language, group);
  }
  return [...groups.entries()];
}

function progressBar(done: number, total: number): string {
  const width = 24;
  const ratio = total === 0 ? 1 : Math.min(Math.max(done / total, 0), 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return `[${c.success('#'.repeat(filled))}${c.dim('-'.repeat(empty))}]`;
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);

  const edgeLength = Math.floor((maxLength - 3) / 2);
  const start = value.slice(0, edgeLength);
  const end = value.slice(value.length - (maxLength - 3 - edgeLength));
  return `${start}...${end}`;
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value : `${value}${' '.repeat(width - value.length)}`;
}

function formatUsage(usage: { totalTokens?: number; costUsd?: number } | undefined): string {
  if (!usage) return '';
  const parts: string[] = [];
  if (usage.totalTokens !== undefined) {
    parts.push(`${usage.totalTokens.toLocaleString()} tokens`);
  }
  if (usage.costUsd !== undefined) {
    parts.push(formatUsd(usage.costUsd));
  }
  return parts.length > 0 ? `  ${c.dim(parts.join(' / '))}` : '';
}

function formatUsd(value: number): string {
  return `$${value.toFixed(value < 0.01 && value > 0 ? 6 : 4)}`;
}
