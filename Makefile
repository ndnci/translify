.PHONY: build dev lint typecheck test clean check-publish-% npm-publish npm-publish-alpha npm-publish-beta npm-publish-rc help

# ── Variables ─────────────────────────────────────────────────────────────────
PACKAGE := @ndnci/translify
FILTER  := --filter $(PACKAGE)
PUBLISH_FLAGS := --access public --no-git-checks

# ── Development ───────────────────────────────────────────────────────────────

build:          ## Build all packages
	pnpm turbo build

dev:            ## Start dev mode (watch)
	pnpm turbo dev

lint:           ## Lint all packages
	pnpm turbo lint

typecheck:      ## Type-check all packages
	pnpm turbo typecheck

test:           ## Run tests for all packages
	pnpm turbo test

clean:          ## Remove all dist folders and node_modules
	pnpm turbo clean && rm -rf node_modules

# ── Publishing ────────────────────────────────────────────────────────────────
# Each target runs scripts/check-publish.sh first: it verifies the version in
# packages/cli/package.json matches the channel (e.g. alpha needs a -alpha.N
# version), isn't already published, that build/typecheck/lint/test all pass,
# and that you're logged in to npm — before anything is actually published.
# Local publishing uses the authenticated npm session. The GitHub Actions
# trusted publisher adds provenance automatically through OIDC.

check-publish-%:
	@bash scripts/check-publish.sh $*

npm-publish: check-publish-latest    ## Build and publish $(PACKAGE) as stable (tag: latest)
	pnpm turbo build --filter="$(PACKAGE)..."
	pnpm $(FILTER) publish $(PUBLISH_FLAGS)

npm-publish-alpha: check-publish-alpha ## Build and publish $(PACKAGE) as pre-release (tag: alpha)
	pnpm turbo build --filter="$(PACKAGE)..."
	pnpm $(FILTER) publish $(PUBLISH_FLAGS) --tag alpha

npm-publish-beta: check-publish-beta  ## Build and publish $(PACKAGE) as pre-release (tag: beta)
	pnpm turbo build --filter="$(PACKAGE)..."
	pnpm $(FILTER) publish $(PUBLISH_FLAGS) --tag beta

npm-publish-rc: check-publish-rc      ## Build and publish $(PACKAGE) as release candidate (tag: rc)
	pnpm turbo build --filter="$(PACKAGE)..."
	pnpm $(FILTER) publish $(PUBLISH_FLAGS) --tag rc

# ── Help ──────────────────────────────────────────────────────────────────────

help:           ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
