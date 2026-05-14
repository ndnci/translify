import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';

const CONFIG_TEMPLATE = `import { defineConfig } from '@ndnci/translify/config';

export default defineConfig({
  source: {
    include: ['src/**/*.{ts,tsx,js,jsx}'],
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
});
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
      await runInit({ cwd, force: opts.force }, logger);
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
  process.stdout.write(`  2. Run ${c.brand('translify extract')} to scan your source files\n`);
  process.stdout.write(`  3. Run ${c.brand('translify sync')} to sync translation files\n\n`);
}
