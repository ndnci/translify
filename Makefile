.PHONY: build dev lint typecheck test clean changeset version release help

# ── Development ───────────────────────────────────────────────────────────────

build:          ## Build all packages
	pnpm build

dev:            ## Start dev mode (watch, parallel)
	pnpm dev

lint:           ## Lint all packages
	pnpm lint

typecheck:      ## Type-check all packages
	pnpm typecheck

test:           ## Run tests for all packages
	pnpm test

clean:          ## Remove all dist folders and node_modules
	pnpm clean:all

# ── Releasing (Changesets) ───────────────────────────────────────────────────

changeset:      ## Create a new changeset for the current changes
	pnpm changeset

version:        ## Consume changesets and bump package versions/changelogs
	pnpm version-packages

release:        ## Build and publish all packages to npm (also runs via CI on tag push)
	pnpm release

# ── Help ──────────────────────────────────────────────────────────────────────

help:           ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
