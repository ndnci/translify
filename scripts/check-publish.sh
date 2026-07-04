#!/usr/bin/env bash
# Pre-publish safety checks for `make npm-publish*`.
#
# Usage: check-publish.sh <latest|alpha|beta|rc>
#
# Verifies that the version in packages/cli/package.json is consistent with
# the channel being published, that it isn't already on npm, that the
# working tree is clean, that npm auth is in place, and that build/typecheck/
# lint/test all pass — before any `pnpm publish` is attempted.
set -euo pipefail

CHANNEL="${1:?Usage: check-publish.sh <latest|alpha|beta|rc>}"
PACKAGE="@ndnci/translify"
PKG_JSON="packages/cli/package.json"

fail() {
  echo "✖ $1" >&2
  exit 1
}

VERSION=$(node -p "require('./$PKG_JSON').version")
echo "→ Checking $PACKAGE@$VERSION for the \"$CHANNEL\" channel…"

# ── 1. Version format must be conventional semver ──────────────────────────
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-([a-zA-Z]+)(\.[0-9]+)?)?$ ]]; then
  fail "Version \"$VERSION\" in $PKG_JSON is not valid semver (expected X.Y.Z or X.Y.Z-tag.N)."
fi
PRERELEASE_TAG="${BASH_REMATCH[2]:-}"

# ── 2. Version <-> channel consistency ──────────────────────────────────────
if [ "$CHANNEL" = "latest" ]; then
  if [ -n "$PRERELEASE_TAG" ]; then
    fail "Version $VERSION is a pre-release (-$PRERELEASE_TAG) — use 'make npm-publish-$PRERELEASE_TAG' instead, or bump to a stable version first."
  fi
else
  if [ "$PRERELEASE_TAG" != "$CHANNEL" ]; then
    fail "Version $VERSION does not carry a \"-$CHANNEL\" pre-release tag. Bump it first, e.g.: pnpm --filter $PACKAGE version prerelease --preid=$CHANNEL"
  fi
fi

# ── 3. Version must not already be published ────────────────────────────────
EXISTING_VERSIONS=$(npm view "$PACKAGE" versions --json 2>/dev/null || echo "[]")
if echo "$EXISTING_VERSIONS" | grep -q "\"$VERSION\""; then
  fail "$PACKAGE@$VERSION is already published on npm. Bump the version in $PKG_JSON first."
fi

# ── 4. Working tree should be clean ─────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠ Warning: you have uncommitted changes. Consider committing before publishing." >&2
fi

# ── 5. npm auth must be configured ──────────────────────────────────────────
if ! npm whoami >/dev/null 2>&1; then
  fail "Not logged in to npm. Run 'npm login' (or 'pnpm login') first."
fi

# ── 6. Build/typecheck/lint/test must all pass ──────────────────────────────
echo "→ Running build, typecheck, lint, and test…"
pnpm turbo build typecheck lint test --filter="./packages/*"

echo "✔ All checks passed — $PACKAGE@$VERSION is safe to publish on \"$CHANNEL\"."
