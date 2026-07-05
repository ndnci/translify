import { Command } from 'commander';
import { VERSION, CLI_NAME } from '@ndnci/translify-shared';
import { createLogger } from './ui/logger.js';
import { c } from './ui/colors.js';
import {
  registerInitCommand,
  registerAddMissingCommand,
  registerTranslateCommand,
  registerCheckUnusedCommand,
  registerCheckMissingCommand,
  registerCheckDuplicatesCommand,
  registerCheckConsistencyCommand,
  registerOptimizeCommand,
  registerAuditCommand,
  registerDoctorCommand,
  registerUpgradeCommand,
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
${c.dim('Checks (read-only):')}
  ${c.brand('check-missing')}      Keys used in code but missing from translation files
  ${c.brand('check-unused')}       Keys defined in translation files but unused in code
  ${c.brand('check-duplicates')}   Duplicate values and duplicate keys in translation files
  ${c.brand('check-consistency')}  Keys not mirrored across every locale
  ${c.brand('audit')}              Run every check above in one pass (alias: check-all)

${c.dim('Actions:')}
  ${c.brand('init')}          Initialize a config file
  ${c.brand('add-missing')}   Add keys used in code but missing from translation files
  ${c.brand('translate')}     Auto-translate via AI
  ${c.brand('optimize')}      Sort keys and flag empty entries in translation files
  ${c.brand('doctor')}        Check setup and environment
  ${c.brand('upgrade')}       Update the CLI to the latest version

${c.dim('Examples:')}
  ${c.dim('$')} translify init
  ${c.dim('$')} translify audit
  ${c.dim('$')} translify add-missing --dry-run
  ${c.dim('$')} translify check-consistency --output report.json

${c.dim('Documentation:')} https://ndnci.github.io/translify/commands/
`,
    );

  // Register all commands
  // The logger is created with current --verbose flag value parsed at runtime
  // Each command creates its own logger instance after parsing
  const getLogger = () =>
    createLogger({ verbose: program.opts<{ verbose: boolean }>().verbose ?? false });

  registerInitCommand(program, getLogger());
  registerAddMissingCommand(program, getLogger());
  registerTranslateCommand(program, getLogger());
  registerCheckUnusedCommand(program, getLogger());
  registerCheckMissingCommand(program, getLogger());
  registerCheckDuplicatesCommand(program, getLogger());
  registerCheckConsistencyCommand(program, getLogger());
  registerOptimizeCommand(program, getLogger());
  registerAuditCommand(program, getLogger());
  registerDoctorCommand(program, getLogger());
  registerUpgradeCommand(program, getLogger());

  return program;
}
