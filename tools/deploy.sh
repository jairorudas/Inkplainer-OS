#!/usr/bin/env bash
# Publishes a commit of this repo (default: main) to Cloudflare Pages with wrangler's direct upload.
# No GitHub involved: only the files committed in that ref are uploaded, and functions/ (the login) goes with them.
#
#   PAGES_PROJECT=inkplainer tools/deploy.sh [ref]
#
# One-off setup, from a terminal where you are logged in (`npx wrangler login`):
#   npx wrangler pages project create "$PAGES_PROJECT" --production-branch main
#   npx wrangler pages secret put ACCESS_TOKEN --project-name "$PAGES_PROJECT"     # optional: turns the token screen on
set -euo pipefail

ref="${1:-main}"
project="${PAGES_PROJECT:-}"
[ -n "$project" ] || { echo "deploy: set PAGES_PROJECT to the Cloudflare Pages project name" >&2; exit 2; }

root="$(git rev-parse --show-toplevel)"
sha="$(git -C "$root" rev-parse --verify --quiet "$ref^{commit}")" || { echo "deploy: unknown ref '$ref'" >&2; exit 2; }

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
git -C "$root" archive "$sha" | tar -x -C "$stage"

echo "deploy: ${sha:0:7} -> $project"
# Run from the staged copy: wrangler looks for functions/ in the directory it runs from.
cd "$stage"
exec ${WRANGLER:-npx --yes wrangler} pages deploy . --project-name "$project" --branch main --commit-hash "$sha" --commit-dirty=false
