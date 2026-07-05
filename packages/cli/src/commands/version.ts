import type { Command } from 'commander';
import type { CliLogger } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { c } from '../ui/colors.js';
import {
  getInstalledVersion,
  distTagFromVersion,
  fetchLatestVersion,
  compareVersions,
} from './upgrade.js';

export function registerVersionCommand(program: Command, logger: CliLogger): void {
  program
    .command('version')
    .description('Print the installed version and check whether a newer one is available')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify version
`,
    )
    .action(async () => {
      const installedVersion = getInstalledVersion();
      process.stdout.write(`${c.brand('translify')} ${c.bold(installedVersion ?? 'unknown')}\n`);

      const distTag = distTagFromVersion(installedVersion);
      const spinner = createSpinner('Checking for updates…');
      const latest = await fetchLatestVersion(distTag);
      spinner.stop();

      if (!latest) {
        logger.debug('Could not reach the npm registry to check for updates.');
        return;
      }

      if (!installedVersion || compareVersions(installedVersion, latest) >= 0) {
        logger.success('You are on the latest version.');
        return;
      }

      logger.info(
        `A new version is available: ${c.dim(installedVersion)} ${c.arrow} ${c.success(latest)}`,
      );
      logger.info(`Run ${c.brand('translify upgrade')} to update.`);
    });
}
