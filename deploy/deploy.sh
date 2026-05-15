#!/usr/bin/env bash
#
# Daari — single-command deploy script.
#
# Run from your laptop:
#   ./deploy/deploy.sh api          # backend only
#   ./deploy/deploy.sh dashboard    # dashboard only
#   ./deploy/deploy.sh both         # both
#
# Assumes:
#  - VPS is reachable as root@45.84.138.119 via ~/.ssh/phibit_deploy
#  - /root/PROJECTS.md has been updated to claim daari ports + paths
#  - First-time setup (vps-bootstrap.sh) has already run on the server
#
# This script is INTENTIONALLY conservative:
#  - rsync --delete is scoped to the app directory, never to /var/www
#  - we never restart services we don't own (daari-api / daari-dashboard)
#  - we never touch other projects' nginx configs

set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 {api|dashboard|both}" >&2
  exit 1
fi

SSH_KEY="${SSH_KEY:-$HOME/.ssh/phibit_deploy}"
SSH_TARGET="${SSH_TARGET:-root@45.84.138.119}"
SSH="ssh -i $SSH_KEY $SSH_TARGET"
RSYNC_SSH="ssh -i $SSH_KEY"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# -----------------------------------------------------------------------------
# Pre-flight: registry check. CLAUDE.md is explicit about this.
# -----------------------------------------------------------------------------
echo "→ Checking /root/PROJECTS.md on VPS..."
if ! $SSH 'test -f /root/PROJECTS.md && grep -q "^- daari" /root/PROJECTS.md'; then
  cat >&2 <<EOF
[ABORT] /root/PROJECTS.md does not have a daari entry yet.
Add it manually before running deploy:

  ssh -i $SSH_KEY $SSH_TARGET
  vim /root/PROJECTS.md
  # Add lines like:
  #   - daari (api)        port 3001  /var/www/daari-api         systemd: daari-api
  #   - daari (dashboard)  port 3002  /var/www/daari-dashboard   systemd: daari-dashboard
EOF
  exit 1
fi

deploy_api() {
  echo ""
  echo "── Deploying API ──────────────────────────────────────────"

  echo "→ Building backend locally..."
  ( cd "$REPO_ROOT/backend" && npm ci && npx prisma generate && npm run build )

  echo "→ Syncing /var/www/daari-api..."
  rsync -avz --delete \
    --exclude node_modules \
    --exclude .env \
    --exclude .env.local \
    --exclude .git \
    -e "$RSYNC_SSH" \
    "$REPO_ROOT/backend/" "$SSH_TARGET:/var/www/daari-api/"

  echo "→ Installing prod deps + migrating DB on VPS..."
  $SSH bash <<'REMOTE'
set -euo pipefail
cd /var/www/daari-api
npm ci --omit=dev
npx prisma migrate deploy
mkdir -p /var/log/daari
chown -R daari:daari /var/log/daari /var/www/daari-api
systemctl restart daari-api
sleep 2
systemctl is-active daari-api && echo "✓ daari-api running"
REMOTE
}

deploy_dashboard() {
  echo ""
  echo "── Deploying Dashboard ───────────────────────────────────"

  echo "→ Building dashboard locally..."
  ( cd "$REPO_ROOT/dashboard" && npm ci && npm run build )

  echo "→ Syncing /var/www/daari-dashboard..."
  rsync -avz --delete \
    --exclude node_modules \
    --exclude .env \
    --exclude .env.local \
    --exclude .git \
    -e "$RSYNC_SSH" \
    "$REPO_ROOT/dashboard/" "$SSH_TARGET:/var/www/daari-dashboard/"

  echo "→ Installing prod deps on VPS..."
  $SSH bash <<'REMOTE'
set -euo pipefail
cd /var/www/daari-dashboard
npm ci --omit=dev
chown -R daari:daari /var/www/daari-dashboard
systemctl restart daari-dashboard
sleep 2
systemctl is-active daari-dashboard && echo "✓ daari-dashboard running"
REMOTE
}

case "$TARGET" in
  api)        deploy_api ;;
  dashboard)  deploy_dashboard ;;
  both)       deploy_api; deploy_dashboard ;;
  *)          echo "Unknown target: $TARGET" >&2; exit 1 ;;
esac

echo ""
echo "✓ Deploy complete."
