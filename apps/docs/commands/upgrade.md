# `translify upgrade`

Update the globally installed Translify CLI to the latest version.

## Usage

```bash
translify upgrade
```

```bash
translify upgrade --to 0.2.0
```

## How it works

1. Detects which package manager (`npm`, `pnpm`, or `yarn`) was used to install
   the CLI globally, based on its own install path.
2. Reads the currently installed version and infers the release channel
   (`latest`, `alpha`, `beta`, or `rc`) from it — a version like `0.2.0-beta.1`
   stays on the `beta` channel.
3. Queries the npm registry for the latest version on that channel (or uses
   `--to` if provided).
4. Re-runs the equivalent global install command (e.g.
   `npm install -g @ndnci/translify@latest`) to update the package in place.

If the installed version already matches the target version, `translify upgrade`
reports that you're up to date and exits without reinstalling.

## Options

| Option           | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `--to <version>` | Install a specific version instead of the latest on your current channel |

## Example output

```
info  Upgrading @ndnci/translify: 0.0.4 → 0.0.5 (via npm)

added 1 package in 2s

✓ Translify upgraded to 0.0.5.
```

## Exit code

- `0` — already up to date, or upgrade succeeded
- `1` — the registry couldn't be reached, or the global install command failed
