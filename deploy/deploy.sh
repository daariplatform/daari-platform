#!/usr/bin/env bash
#
# Daari Water — single-command deploy script.
#
# Run from your laptop:
#   ./deploy/deploy.sh api          # backend only
#   ./deploy/deploy.sh dashboard    # dashboard only
#   ./deploy/deploy.sh both         # both
#
# Assumes:
#  - SSH_TARGET is set to your server (e.g. root@1.2.3.4) via ~/.ssh/phibit_deploy
#    NOTE: the previous VPS (45.84.138.119) was decommissioned — there is no
#    hardcoded default anymore, so you MUST pass SSH_TARGET explicitly.
#  - /root/PROJECTS.md already has the "Daari Water" entry
#  - First-time setup (vps-bootstrap.sh) has already run on the server
#
# This script is INTENTIONALLY conservative — the Phi-Bit VPS is multi-
# tenant and runs other production projects (PhiBit, Dar Al-Safari Daari,
# Dr.Cars, DoctorHub). We never:
#  - rsync --delete outside /var/www/daari-water-* (i.e. our own subtree)
#  - restart any service whose name doesn't start with "daari-water-"
#  - touch nginx vhosts that aren't ours
#  - shell into /home/daari (a different project's directory)

set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 {api|dashboard|both}" >&2
  exit 1
fi

SSH_KEY="${SSH_KEY:-$HOME/.ssh/phibit_deploy}"
# The previous VPS (45.84.138.119) was decommissioned. There is deliberately NO
# default target — set SSH_TARGET to your current server so we never rsync/ssh to
# a stale IP that the hosting provider may have reassigned to someone else.
SSH_TARGET="${SSH_TARGET:-}"
if [[ -z "$SSH_TARGET" ]]; then
  echo "[ABORT] SSH_TARGET is not set (the old VPS was decommissioned)." >&2
  echo "        Example:  SSH_TARGET=root@YOUR_SERVER_IP ./deploy/deploy.sh api" >&2
  exit 1
fi
SSH="ssh -i $SSH_KEY $SSH_TARGET"
RSYNC_SSH="ssh -i $SSH_KEY"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# -----------------------------------------------------------------------------
# Pre-flight: registry check. CLAUDE.md is explicit about this.
# -----------------------------------------------------------------------------
echo "→ Checking /root/PROJECTS.md on VPS..."
if ! $SSH 'test -f /root/PROJECTS.md && grep -qE "(daari-water|Daari Water)" /root/PROJECTS.md'; then
  cat >&2 <<EOF
[ABORT] /root/PROJECTS.md does not have a daari-water entry yet.

The Phi-Bit VPS already runs another project named "Daari" (Dar Al-Safari)
on port 3000. We deliberately use the slug "daari-water" to avoid conflicts.
Append the registry entry from deploy/PROJECTS-MD-ENTRY.md before deploying.
EOF
  exit 1
fi

deploy_api() {
  echo ""
  echo "── Deploying daari-water API ────────────────────────────────"

  echo "→ Building backend locally..."
  ( cd "$REPO_ROOT/backend" && npm ci && npx prisma generate && npm run build )

  echo "→ Syncing /var/www/daari-water-api..."
  rsync -avz --delete \
    --exclude node_modules \
    --exclude .env \
    --exclude .env.local \
    --exclude .git \
    -e "$RSYNC_SSH" \
    "$REPO_ROOT/backend/" "$SSH_TARGET:/var/www/daari-water-api/"

  echo "→ Installing prod deps + migrating DB on VPS..."
  $SSH bash <<'REMOTE'
set -euo pipefail
cd /var/www/daari-water-api
npm ci --omit=dev
# This project syncs the schema with `prisma db push`, NOT migrations (there is
# no prisma/migrations folder — see README §9). `db push` also regenerates the
# client by default, so a fresh DB gets its tables and the app boots cleanly.
# (Previously this ran `prisma migrate deploy`, which on a migration-less repo
# creates ZERO tables and crashes the API on first query.)
npx prisma db push --skip-generate
npx prisma generate
# Seed the PLATFORM_ADMIN (idempotent). Without this row /platform/* is
# unreachable and no tenant can be created — a fresh DB has zero platform
# admins. Uses a plain-JS script (not `prisma db seed`/ts-node, which are
# devDependencies absent under --omit=dev). Requires PLATFORM_ADMIN_PHONE +
# PLATFORM_ADMIN_PASSWORD in .env; fails loud (set -e) if the password is unset
# rather than shipping a known default. It seeds NO demo data.
node prisma/seed-prod.cjs
# Ensure the log dir and the uploads tree exist and are owned by the service
# user. UPLOADS_DIR in .env must point at .../uploads (see
# .env.production.example) — it lives inside the systemd ReadWritePaths so the
# app can write proof photos + report files that nginx then serves from
# /uploads/. The app also mkdirs these at boot; this is belt-and-suspenders so
# a fresh box has them with the right owner from the first request.
mkdir -p /var/log/daari-water \
         /var/www/daari-water-api/uploads/proof \
         /var/www/daari-water-api/uploads/reports
chown -R daari-water:daari-water /var/log/daari-water /var/www/daari-water-api
systemctl restart daari-water-api
sleep 2
systemctl is-active daari-water-api && echo "✓ daari-water-api running"
REMOTE
}

deploy_dashboard() {
  echo ""
  echo "── Deploying daari-water Dashboard ──────────────────────────"

  echo "→ Building dashboard locally..."
  ( cd "$REPO_ROOT/dashboard" && npm ci && npm run build )

  echo "→ Syncing /var/www/daari-water-dashboard..."
  rsync -avz --delete \
    --exclude node_modules \
    --exclude .env \
    --exclude .env.local \
    --exclude .git \
    -e "$RSYNC_SSH" \
    "$REPO_ROOT/dashboard/" "$SSH_TARGET:/var/www/daari-water-dashboard/"

  echo "→ Installing prod deps on VPS..."
  $SSH bash <<'REMOTE'
set -euo pipefail
cd /var/www/daari-water-dashboard
npm ci --omit=dev
chown -R daari-water:daari-water /var/www/daari-water-dashboard
systemctl restart daari-water-dashboard
sleep 2
systemctl is-active daari-water-dashboard && echo "✓ daari-water-dashboard running"
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
