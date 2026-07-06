import { Command } from 'commander';
import { VERSION, CLI_NAME } from '@ndnci/translify-shared';
import { createLogger } from './ui/logger.js';
import { c } from './ui/colors.js';
import {
  registerInitCommand,
  registerAddLanguagesCommand,
  registerAddMissingCommand,
  registerConfigUpgradeCommand,
  registerTranslateCommand,
  registerCheckConfigCommand,
  registerCheckHardcodedCommand,
  registerCheckUnusedCommand,
  registerCheckMissingCommand,
  registerCheckDuplicatesCommand,
  registerCheckConsistencyCommand,
  registerOptimizeCommand,
  registerAuditCommand,
  registerAuditFixCommand,
  registerHardcodedFixCommand,
  registerSplitTranslationsCommand,
  registerUpgradeCommand,
  registerVersionCommand,
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
  ${c.brand('check-hardcoded')}    User-facing text that is hardcoded in source files
  ${c.brand('check-config')}       Validate config shape, values, and unknown keys
  ${c.brand('audit')}              Run every check above in one pass

${c.dim('Actions:')}
  ${c.brand('init')}          Initialize a config file
  ${c.brand('config-upgrade')} Add new config keys without overwriting values
  ${c.brand('add-missing')}   Add keys used in code but missing from translation files
  ${c.brand('add-languages')} Create translation files for new languages
  ${c.brand('split-translations')} Split large locale files by context
  ${c.brand('audit-fix')}     Fix deterministic audit issues
  ${c.brand('hardcoded-fix')} Replace hardcoded text with i18n calls
  ${c.brand('translate')}     Auto-translate via AI
  ${c.brand('optimize')}      Sort keys and flag empty entries in translation files
  ${c.brand('version')}       Print the installed version and check for updates
  ${c.brand('upgrade')}       Update the CLI to the latest version

${c.dim('Examples:')}
  ${c.dim('$')} translify init
  ${c.dim('$')} translify config-upgrade
  ${c.dim('$')} translify audit
  ${c.dim('$')} translify split-translations --groups "tools=tool|foo,auth=auth"
  ${c.dim('$')} translify add-languages it de --empty
  ${c.dim('$')} translify audit-fix --dry-run
  ${c.dim('$')} translify hardcoded-fix --dry-run
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

  registerCheckConfigCommand(program, getLogger());
  registerInitCommand(program, getLogger());
  registerConfigUpgradeCommand(program, getLogger());
  registerAddLanguagesCommand(program, getLogger());
  registerAddMissingCommand(program, getLogger());
  registerTranslateCommand(program, getLogger());
  registerCheckHardcodedCommand(program, getLogger());
  registerCheckUnusedCommand(program, getLogger());
  registerCheckMissingCommand(program, getLogger());
  registerCheckDuplicatesCommand(program, getLogger());
  registerCheckConsistencyCommand(program, getLogger());
  registerOptimizeCommand(program, getLogger());
  registerAuditCommand(program, getLogger());
  registerAuditFixCommand(program, getLogger());
  registerHardcodedFixCommand(program, getLogger());
  registerSplitTranslationsCommand(program, getLogger());
  registerUpgradeCommand(program, getLogger());
  registerVersionCommand(program, getLogger());

  return program;
}
