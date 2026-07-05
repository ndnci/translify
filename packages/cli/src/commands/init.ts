import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';

const CONFIG_TEMPLATE = `// Optional editor autocomplete: install @ndnci/translify as a devDependency
// (npm i -D @ndnci/translify) and uncomment the line below. Not required to
// run the CLI — this file works as-is even if Translify is only installed globally.
// /** @type {import('@ndnci/translify/config').TranslifyConfig} */
export default {
  source: {
    include: ['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}'],
    exclude: [
      '**/*.test.*',
      '**/*.spec.*',
      '**/node_modules/**',
      '**/dist/**',
    ],
  },

  translations: {
    default_language: 'en',
    files: ['messages/*.json'],
  },

  extraction: {
    translation_functions: ['t', 'i18n.t', 'translate'],
    // Also recognizes your own custom wrapper hooks around useTranslations/
    // getTranslations (e.g. useFeatureI18n) automatically — no config needed.
    namespace_functions: ['useTranslations', 'getTranslations'],
    ignored_words: ['OK', 'API', 'ID'],
    ignored_patterns: ['^v[0-9]+$'],
    custom_regex_patterns: [],
    include_comments: false,
  },

  detection: {
    ignore_files_containing: [],
    ignore_paths_containing: [],
    ignore_filenames_matching: [],
  },

  ai_translation: {
    enabled: false,
    provider: 'openai',
    openai_api_key: process.env.OPENAI_API_KEY,
    model: 'gpt-4.1-mini',
    temperature: 0,
  },
};
`;

export interface InitOptions {
  cwd: string;
  force?: boolean;
}

export function registerInitCommand(program: Command, logger: CliLogger): void {
  program
    .command('init')
    .description('Initialize a Translify config file in the current project')
    .option('--force', 'overwrite an existing config file')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify init
  ${c.brand('$')} translify init --force
`,
    )
    .action(async (opts: { force?: boolean }) => {
      const cwd = program.opts<{ cwd: string }>().cwd ?? process.cwd();
      await runInit({ cwd, ...(opts.force !== undefined && { force: opts.force }) }, logger);
    });
}

async function runInit(options: InitOptions, logger: CliLogger): Promise<void> {
  const configPath = join(options.cwd, 'translify.config.ts');

  if (existsSync(configPath) && !options.force) {
    logger.warn(`Config already exists at ${c.file(configPath)}`);
    logger.info(`Run with ${c.bold('--force')} to overwrite.`);
    process.exit(1);
  }

  writeFileSync(configPath, CONFIG_TEMPLATE, 'utf8');
  logger.success(`Created ${c.file('translify.config.ts')}`);

  // Create messages directory if it doesn't exist
  const messagesDir = join(options.cwd, 'messages');
  if (!existsSync(messagesDir)) {
    mkdirSync(messagesDir, { recursive: true });
    writeFileSync(join(messagesDir, 'en.json'), '{}\n', 'utf8');
    logger.success(`Created ${c.file('messages/en.json')}`);
  }

  logger.spacer();
  logger.info(`Next steps:`);
  process.stdout.write(`\n  1. Edit ${c.file('translify.config.ts')} to match your project\n`);
  process.stdout.write(
    `  2. Run ${c.brand('translify audit')} for a full health report (missing, unused, duplicate, and inconsistent keys)\n`,
  );
  process.stdout.write(
    `  3. Run ${c.brand('translify add-missing --dry-run')} to preview new keys, then ${c.brand('translify add-missing')} to write them\n\n`,
  );
  process.stdout.write(
    `  ${c.dim('Full command reference:')} https://ndnci.github.io/translify/commands/\n\n`,
  );
}
