import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Reads the published CLI's version from its own package.json, so the docs nav badge can't drift out of sync. */
export function getCliVersion(): string {
  const pkgPath = fileURLToPath(new URL('../../../../packages/cli/package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  return pkg.version;
}
