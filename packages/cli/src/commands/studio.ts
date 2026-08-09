import type { Command } from 'commander';
import { resolveConfig } from '@ndnci/translify-config';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';
import { createStudioService, openDefaultBrowser, startStudioServer } from '../studio/index.js';

export function registerStudioCommand(program: Command, logger: CliLogger): void {
  program
    .command('studio')
    .description('Open a local browser studio for translating text and locale files')
    .option('-p, --port <port>', 'local port to use', parsePort, 4983)
    .option('--no-open', 'do not open the browser automatically')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify studio
  ${c.brand('$')} translify studio --port 5174
  ${c.brand('$')} translify studio --no-open
`,
    )
    .action(async (options: { port: number; open: boolean }) => {
      const { cwd, config: configPath } = program.opts<{ cwd: string; config?: string }>();
      try {
        const resolved = await resolveConfig({ cwd, ...(configPath && { configPath }) });
        const service = await createStudioService({ cwd, config: resolved.config });
        const running = await startStudioServer({ service, port: options.port });

        logger.success(`Studio is running at ${c.file(running.url)}`);
        logger.info('Press Ctrl+C to stop the server.');
        if (options.open) openDefaultBrowser(running.url);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error('Port must be an integer between 0 and 65535');
  }
  return port;
}
