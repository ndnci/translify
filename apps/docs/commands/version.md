# `translify version`

Print the installed version and check whether a newer one is published.

## Usage

```bash
translify version
```

## Example output

```
translify 0.1.0
✓ You are on the latest version.
```

Or, if an update is available:

```
translify 0.1.0
info  A new version is available: 0.1.0 → 0.2.0
info  Run translify upgrade to update.
```

## How it works

Reads the version from the CLI's own `package.json`, then queries the npm
registry for the latest version on the same release channel (`latest`, `alpha`,
`beta`, `rc`) — the same detection `upgrade` uses. If the registry can't be
reached, only the installed version is printed.

## See also

- `translify --version` / `-V` — prints just the version number, no update
  check, no network request.
- [`translify upgrade`](/commands/upgrade) — installs the newer version.
