import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';

export function registerCheckConfigCommand(program: Command, logger: CliLogger): void {
  program
    .command('check-config')
    .description('Validate the Translify config file and report invalid or unknown keys')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify check-config
  ${c.brand('$')} translify check-config --config ./translify.config.ts
`,
    )
    .action(async () => {
      const { cwd, config: configPath } = program.opts<{
        cwd: string;
        config?: string;
      }>();

      try {
        const resolved = await resolveConfig({ cwd, ...(configPath && { configPath }) });

        logger.success('Config is valid');
        logger.spacer();
        logger.kv('File', resolved.configPath);
        logger.kv('Format', resolved.format);
        logger.kv('Default language', resolved.config.translations.default_language);
        logger.kv('Translation globs', resolved.config.translations.files.join(', '));
        logger.spacer();
      } catch (err) {
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}
