import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Command } from 'commander';
import ora from 'ora';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';

const PACKAGE_NAME = '@ndnci/translify';

type PackageManager = 'npm' | 'pnpm' | 'yarn';

/** Detect which global package manager installed this CLI by inspecting its own install path. */
function detectPackageManager(): PackageManager {
  const selfPath = fileURLToPath(import.meta.url);
  if (selfPath.includes('pnpm')) return 'pnpm';
  if (selfPath.includes('yarn') || selfPath.includes('.yarn')) return 'yarn';
  return 'npm';
}

function getInstalledVersion(): string | null {
  try {
    const selfDir = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(selfDir, '..', 'package.json');
    const raw = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
    return typeof raw.version === 'string' ? raw.version : null;
  } catch {
    return null;
  }
}

/** "alpha" | "beta" | "rc" | "latest" → itself. "0.1.3-alpha.1" → "alpha". else → "latest" */
function distTagFromVersion(version: string | null): string {
  if (!version) return 'latest';
  const m = version.match(/-(alpha|beta|rc)\.\d+$/);
  return m?.[1] ?? 'latest';
}

async function fetchLatestVersion(distTag: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}`);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const tags = data['dist-tags'] as Record<string, string> | undefined;
    return tags?.[distTag] ?? null;
  } catch {
    return null;
  }
}

function globalInstallCommand(manager: PackageManager, version: string): [string, string[]] {
  const spec = `${PACKAGE_NAME}@${version}`;
  switch (manager) {
    case 'pnpm':
      return ['pnpm', ['add', '-g', spec]];
    case 'yarn':
      return ['yarn', ['global', 'add', spec]];
    case 'npm':
    default:
      return ['npm', ['install', '-g', spec]];
  }
}

function runInstall(manager: PackageManager, version: string): Promise<boolean> {
  const [cmd, args] = globalInstallCommand(manager, version);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

export interface UpgradeOptions {
  version?: string;
}

export async function upgradeCommand(opts: UpgradeOptions, logger: CliLogger): Promise<void> {
  const manager = detectPackageManager();
  const installedVersion = getInstalledVersion();
  const distTag = distTagFromVersion(installedVersion);

  let targetVersion: string;
  if (opts.version) {
    targetVersion = opts.version;
  } else {
    const spinner = ora(`Checking latest ${distTag} version…`).start();
    const latest = await fetchLatestVersion(distTag);
    spinner.stop();
    if (!latest) {
      logger.error('Could not reach the npm registry. Try again later or pass --version.');
      process.exit(1);
    }
    targetVersion = latest;
  }

  if (installedVersion === targetVersion) {
    logger.success(`Already up to date (${targetVersion}).`);
    return;
  }

  logger.info(
    `Upgrading ${c.brand(PACKAGE_NAME)}: ${installedVersion ?? 'unknown'} ${c.arrow} ${targetVersion} ${c.dim(`(via ${manager})`)}`,
  );

  const ok = await runInstall(manager, targetVersion);
  if (!ok) {
    logger.error(
      `${manager} install failed. You may need to run the command with sudo/admin rights.`,
    );
    process.exit(1);
  }

  logger.success(`Translify upgraded to ${targetVersion}.`);
}

export function registerUpgradeCommand(program: Command, logger: CliLogger): void {
  program
    .command('upgrade')
    .description('Update the globally installed Translify CLI to the latest version')
    .option('--to <version>', 'install a specific version instead of the latest')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify upgrade
  ${c.brand('$')} translify upgrade --to 0.2.0
`,
    )
    .action(async (opts: { to?: string }) => {
      await upgradeCommand({ ...(opts.to !== undefined && { version: opts.to }) }, logger);
    });
}
