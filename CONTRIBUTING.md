# Contributing to Translify

Thank you for your interest in contributing! This guide explains how to set up
the project, run tests, and submit a pull request.

---

## Prerequisites

- Node.js **22+**
- pnpm **10+**
- Git

---

## Setup

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/translify.git
cd translify

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Run tests
pnpm test
```

---

## Project Structure

```
translify/
├── packages/
│   ├── shared/     # Shared types, utilities, constants
│   ├── config/     # Config loading & Zod validation
│   ├── core/       # Scanner, parser, extractor, detection, sync
│   ├── ai/         # OpenAI integration
│   └── cli/        # CLI commands (Commander.js)
├── apps/
│   ├── docs/       # VitePress documentation
│   └── demo-nextjs/# Demo Next.js application
└── docs/           # Architecture & development guides
```

---

## Development Workflow

### Run a specific package in dev mode

```bash
# From the monorepo root
pnpm --filter @ndnci/translify-core dev

# Or from the package directory
cd packages/core
pnpm dev
```

### Run tests for a specific package

```bash
pnpm --filter @ndnci/translify-core test
```

### Run the CLI locally

```bash
cd packages/cli
pnpm dev
# Then test it:
node dist/index.js --help
```

---

## Code Standards

- **TypeScript strict mode** — all code must type-check with zero errors.
- **ESLint** — run `pnpm lint` to check. Fix all warnings.
- **Prettier** — run `pnpm format` before committing.
- **Vitest** — write tests for all new functionality.
- **Conventional Commits** — commit messages must follow the format:
  ```
  feat(core): add Vue SFC parser
  fix(cli): correct missing key display format
  docs(config): add ai_translation examples
  ```

---

## Submitting a Pull Request

1. Create a branch: `git checkout -b feat/my-feature`
2. Make your changes, add tests
3. Run `pnpm lint && pnpm typecheck && pnpm test`
4. Commit using Conventional Commits
5. Push and open a PR against `main`

### Changeset (for library changes)

If your change affects a published package, add a changeset:

```bash
pnpm changeset
```

Follow the prompts. This generates a changelog entry that will be included in
the next release.

---

## Releasing

Only `@ndnci/translify` (the CLI) is published to npm — the other packages
(`shared`, `config`, `core`, `ai`) are internal (`"private": true"`) and are
only versioned for internal dependency tracking.

### Automated (CI)

Pushing a tag matching `v*` triggers
[`.github/workflows/publish.yml`](.github/workflows/publish.yml), which builds,
tests, and runs `pnpm changeset publish`. Authentication uses **npm Trusted
Publishing (OIDC)** — no `NPM_TOKEN` secret is required. This must be configured
once per package on npmjs.com:

1. Go to the
   [`@ndnci/translify` package settings](https://www.npmjs.com/package/@ndnci/translify/access)
   → **Trusted Publisher**.
2. Select **GitHub Actions** and set:
   - Organization/repository: `ndnci/translify`
   - Workflow filename: `publish.yml` (just the filename, not the full path)
3. Save. The workflow's `permissions: id-token: write` handles the rest.

### Manual (local)

For a one-off publish without going through CI, use the `Makefile` (requires
`npm login`/`pnpm login` with an account that has publish rights — Trusted
Publishing only applies to the GitHub Actions workflow, not local publishes):

```bash
make npm-publish          # stable release (tag: latest)
make npm-publish-alpha    # pre-release (tag: alpha)
make npm-publish-beta     # pre-release (tag: beta)
make npm-publish-rc       # release candidate (tag: rc)
```

## Adding a New Parser

See [docs/HOW_TO_ADD_PARSER.md](./docs/HOW_TO_ADD_PARSER.md).

## Adding a New AI Provider

See [docs/HOW_TO_ADD_AI_PROVIDER.md](./docs/HOW_TO_ADD_AI_PROVIDER.md).

---

## Code of Conduct

Be respectful, constructive, and inclusive. We follow the
[Contributor Covenant](https://www.contributor-covenant.org/).
