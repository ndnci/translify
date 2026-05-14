# How to Release a New Version

This document describes the full release process for Translify maintainers.

---

## Prerequisites

- You have write access to the GitHub repository
- Your local `main` branch is up to date
- You have a valid npm token in `NPM_TOKEN` GitHub secret

---

## Step 1 — Make your changes

Work on your feature or fix on a branch, then open a PR to `main`.

---

## Step 2 — Add a changeset

Before or after your changes, document what changed:

```bash
pnpm changeset
```

The CLI will ask:

1. Which packages changed?
2. Was this a `major`, `minor`, or `patch` change?
3. Write a brief changelog entry.

This creates a `.changeset/*.md` file — commit it with your changes.

### Versioning rules (semver)

| Change type                     | Bump  |
| ------------------------------- | ----- |
| Breaking API change             | major |
| New feature (backward compat)   | minor |
| Bug fix or internal improvement | patch |

---

## Step 3 — Merge to main

Once approved, merge your PR. The changeset file is now on `main`.

---

## Step 4 — Create a version PR (or version directly)

The `changeset version` command consumes all pending changesets, updates
`package.json` versions, and writes `CHANGELOG.md` entries:

```bash
pnpm version-packages
# or: pnpm changeset version
```

Review the diff, then commit and push:

```bash
git add .
git commit -m "chore: release packages"
git push
```

---

## Step 5 — Tag and push

```bash
# For a standard release (e.g., v0.2.0)
git tag v0.2.0
git push origin v0.2.0

# For a pre-release
git tag v0.2.0-beta.1
git push origin v0.2.0-beta.1
```

The `publish.yml` GitHub Action triggers on `v*` tags and:

1. Builds all packages
2. Runs tests
3. Detects pre-release vs stable from the tag name
4. Publishes to npm with provenance
5. Creates a GitHub Release with auto-generated notes

---

## Step 6 — Verify

Check that the packages appear on npm:

```bash
npm info @ndnci/translify
```

And that the GitHub Release was created correctly.

---

## Hotfixes

For urgent fixes on an already-released version:

```bash
git checkout -b hotfix/v0.1.1 v0.1.0
# ... make fix ...
pnpm changeset
git commit -m "fix: ..."
git tag v0.1.1
git push origin v0.1.1
```

---

## First-time npm token setup

1. Create a new token at npmjs.com → Access Tokens → Generate New Token
   (Automation)
2. Add it to GitHub: Settings → Secrets → Actions → New repository secret →
   `NPM_TOKEN`
