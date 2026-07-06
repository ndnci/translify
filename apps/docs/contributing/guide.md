# Contributing Guide

Thanks for helping improve Translify.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Git

## Setup

```bash
git clone https://github.com/<your-username>/translify.git
cd translify
pnpm install
pnpm build
pnpm test
```

## Development

Run a package in watch mode:

```bash
pnpm --filter @ndnci/translify-core dev
```

Run tests for one package:

```bash
pnpm --filter @ndnci/translify-core test
```

Run the CLI locally:

```bash
cd packages/cli
pnpm dev
node dist/index.js --help
```

## Checks

Before opening a PR, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Pull Requests

1. Create a branch, for example `feat/my-feature`
2. Make the change and add focused tests
3. Update docs when behavior or config changes
4. Use a Conventional Commit message
5. Open a PR against `main`

If your change affects the published CLI package, add a changeset:

```bash
pnpm changeset
```

The full contributing guide lives in the repository at
[`CONTRIBUTING.md`](https://github.com/ndnci/translify/blob/main/CONTRIBUTING.md).
