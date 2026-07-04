import { Command } from 'commander';
import { VERSION, CLI_NAME } from '@ndnci/translify-shared';
import { createLogger } from './ui/logger.js';
import { c } from './ui/colors.js';
import {
  registerInitCommand,
  registerExtractCommand,
  registerSyncCommand,
  registerTranslateCommand,
  registerUnusedCommand,
  registerMissingCommand,
  registerDuplicateCommand,
  registerOptimizeCommand,
  registerAuditCommand,
  registerDoctorCommand,
} from './commands/index.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description(
      `${c.brand('Translify')} — intelligent i18n CLI for extracting, syncing, and translating`,
    )
    .version(VERSION, '-V, --version', 'Print the Translify version')
    .helpOption('-h, --help', 'Show help')
    // ── Global options ──────────────────────────────────────────────────────
    .option(
      '-c, --config <path>',
      'Path to config file (default: auto-discover translify.config.*)',
    )
    .option('--cwd <path>', 'Working directory (default: process.cwd())', process.cwd())
    .option('--dry-run', 'Preview changes without writing files', false)
    .option('--verbose', 'Enable verbose output', false)
    .addHelpText(
      'after',
      `
${c.dim('Commands:')}
  ${c.brand('init')}        Initialize a config file
  ${c.brand('extract')}     Extract translation keys from source
  ${c.brand('sync')}        Sync translation files across languages
  ${c.brand('translate')}   Auto-translate via AI
  ${c.brand('unused')}      Detect unused translation keys
  ${c.brand('missing')}     Detect missing translation keys
  ${c.brand('duplicate')}   Detect duplicate translation values
  ${c.brand('optimize')}    Optimize and format translation files
  ${c.brand('audit')}       Full i18n health audit
  ${c.brand('doctor')}      Check setup and environment

${c.dim('Examples:')}
  ${c.dim('$')} translify init
  ${c.dim('$')} translify extract --verbose
  ${c.dim('$')} translify sync --dry-run
  ${c.dim('$')} translify audit --config ./config/translify.config.ts

${c.dim('Documentation:')} https://ndnci.github.io/translify/
`,
    );

  // Register all commands
  // The logger is created with current --verbose flag value parsed at runtime
  // Each command creates its own logger instance after parsing
  const getLogger = () =>
    createLogger({ verbose: program.opts<{ verbose: boolean }>().verbose ?? false });

  registerInitCommand(program, getLogger());
  registerExtractCommand(program, getLogger());
  registerSyncCommand(program, getLogger());
  registerTranslateCommand(program, getLogger());
  registerUnusedCommand(program, getLogger());
  registerMissingCommand(program, getLogger());
  registerDuplicateCommand(program, getLogger());
  registerOptimizeCommand(program, getLogger());
  registerAuditCommand(program, getLogger());
  registerDoctorCommand(program, getLogger());

  return program;
}
