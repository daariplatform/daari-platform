#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# github-setup.sh
#
# One-shot script to create the GitHub repo for maa-platform and push the
# initial commit. Run this AFTER `gh auth login` succeeds.
#
# Usage:
#   cd /Users/ahmedalani/Downloads/maa-platform
#   bash scripts/github-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_NAME="daari-platform"
REPO_DESCRIPTION="داري (Daari) — منصّة الخدمات المنزلية في العراق. تطبيقات الزبون + العامل، لوحة المعمل، Backend NestJS. مشروع شركة Phi-Bit."
# Set to "public" if you want the world to see it, "private" otherwise.
# For a commercial SaaS, private is the default.
VISIBILITY="private"

cd "$(dirname "$0")/.."

# 1. Sanity checks
command -v gh >/dev/null || { echo "❌ gh CLI not installed."; exit 1; }
gh auth status &>/dev/null || { echo "❌ Not logged in. Run: gh auth login --web"; exit 1; }
[ -d .git ] || { echo "❌ Not a git repo. Run from the maa-platform root."; exit 1; }

OWNER=$(gh api user --jq .login)
echo "✓ Authenticated as @$OWNER"

# 2. Bail if remote already configured
if git remote get-url origin &>/dev/null; then
  echo "⚠️  Remote 'origin' already set to: $(git remote get-url origin)"
  echo "Skipping repo creation. Just pushing..."
else
  # 3. Create the GitHub repo
  echo "Creating GitHub repo $OWNER/$REPO_NAME ($VISIBILITY)..."
  gh repo create "$REPO_NAME" \
    --"$VISIBILITY" \
    --description "$REPO_DESCRIPTION" \
    --source . \
    --remote origin \
    --push
  echo "✓ Repo created and pushed."
fi

# 4. Verify
echo ""
echo "─────────────────────────────────────────────────"
echo "  GitHub Repo: https://github.com/$OWNER/$REPO_NAME"
echo "─────────────────────────────────────────────────"
gh repo view "$OWNER/$REPO_NAME" --json url,visibility,defaultBranchRef --jq '"URL:        \(.url)\nVisibility: \(.visibility)\nDefault:    \(.defaultBranchRef.name)"'

# 5. Open in browser
open "https://github.com/$OWNER/$REPO_NAME"
