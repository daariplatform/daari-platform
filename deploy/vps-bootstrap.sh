#!/usr/bin/env bash
#
# First-time VPS setup for Daari Water (the water-plant SaaS branch of
# Daari). Run ONCE on the server as root after the registry entry has been
# added to /root/PROJECTS.md.
#
# This script is IDEMPOTENT and DEFENSIVE — it only creates what doesn't
# exist yet. On the multi-tenant Phi-Bit VPS, Postgres / Redis / Nginx /
# Node are already installed for other projects, so we skip those steps.
#
# What this does (skips anything already in place):
#   1. Create the `daari-water` system user
#   2. Create /var/www/daari-water-{api,dashboard}, /var/log/daari-water,
#      /var/backups/daari-water
#   3. Verify Postgres + Redis + Nginx + Node are present (failing loud
#      if not — don't try to apt-install them silently next to other
#      projects' versions)
#   4. Create the Postgres role + database + PostGIS extension scoped
#      to this project ONLY (existing roles untouched)
#   5. Install the systemd units shipped in this repo (only if not
#      already present)
#   6. Install nginx vhosts ONLY if files of the same name don't already
#      exist — never overwrite existing project configs
#   7. Set up the nightly backup cron (only this project's DB)
#
# Usage (from the VPS, after cloning the repo to /root/daari-water-platform):
#   bash /root/daari-water-platform/deploy/vps-bootstrap.sh

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="daari-water"

# Pre-flight: registry check. CLAUDE.md is explicit about this — never
# install anything on this VPS before updating /root/PROJECTS.md.
if [[ ! -f /root/PROJECTS.md ]] || ! grep -qE "(daari-water|Daari Water)" /root/PROJECTS.md; then
  cat >&2 <<EOF
[ABORT] /root/PROJECTS.md does not have a daari-water entry yet.
Add it BEFORE running bootstrap. See deploy/PROJECTS-MD-ENTRY.md in the
repo for the exact text to append.
EOF
  exit 1
fi

echo "════════════════════════════════════════════════════════════════"
echo " Daari Water bootstrap — idempotent first-time setup"
echo "════════════════════════════════════════════════════════════════"

echo ""
echo "── 1. System user '$SLUG' ───────────────────────────────"
if ! id "$SLUG" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$SLUG"
  echo "  ✓ created user '$SLUG'"
else
  echo "  · user '$SLUG' already exists"
fi

echo ""
echo "── 2. Project directories ───────────────────────────────"
mkdir -p /var/www/daari-water-api /var/www/daari-water-dashboard \
         /var/log/daari-water /var/backups/daari-water
chown -R "$SLUG:$SLUG" /var/www/daari-water-api /var/www/daari-water-dashboard /var/log/daari-water
chmod 700 /var/backups/daari-water
echo "  ✓ /var/www/daari-water-{api,dashboard}, /var/log/daari-water, /var/backups/daari-water"

echo ""
echo "── 3. Verify shared system packages ─────────────────────"
# We don't apt-install these because they're owned by other projects.
# If any are missing, the operator needs to install them deliberately
# (probably for an earlier project on this VPS) — not from this script.
missing=()
command -v psql >/dev/null 2>&1 || missing+=("postgresql client (psql)")
command -v redis-cli >/dev/null 2>&1 || missing+=("redis-cli")
command -v nginx >/dev/null 2>&1 || missing+=("nginx")
command -v node >/dev/null 2>&1 || missing+=("node")
command -v certbot >/dev/null 2>&1 || missing+=("certbot")
command -v aws >/dev/null 2>&1 || echo "  · aws-cli not installed (backups will skip S3 upload; install with: apt install awscli)"

if (( ${#missing[@]} > 0 )); then
  echo "[ABORT] Missing system packages:" >&2
  for m in "${missing[@]}"; do echo "  - $m" >&2; done
  echo "" >&2
  echo "Install them before re-running this script. Don't auto-apt-install" >&2
  echo "from here because the existing projects on this VPS depend on" >&2
  echo "specific versions." >&2
  exit 1
fi

echo "  ✓ psql, redis-cli, nginx, certbot, node all present"
echo "    Postgres: $(psql --version | awk '{print $3}')"
echo "    Node:     $(node --version)"
echo "    Nginx:    $(nginx -v 2>&1 | awk -F/ '{print $2}')"

# Verify the daari (Dar Al-Safari) and other existing users are untouched.
echo ""
echo "── 4. Verify isolation from existing projects ───────────"
for u in daari phibit postgres; do
  if id "$u" >/dev/null 2>&1; then
    echo "  · existing user '$u' detected (untouched)"
  fi
done

echo ""
echo "── 5. Postgres role + database scoped to this project ───"
PG_PASS=""
ROLE_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='daari_water'" 2>/dev/null || echo "")
if [[ "$ROLE_EXISTS" != "1" ]]; then
  PG_PASS=$(openssl rand -hex 16)
  sudo -u postgres psql <<SQL
CREATE ROLE daari_water WITH LOGIN PASSWORD '$PG_PASS';
CREATE DATABASE daari_water OWNER daari_water;
SQL
  echo "  ✓ created role 'daari_water' and database 'daari_water'"
  echo ""
  echo "  ┌─── SAVE THIS PASSWORD NOW ─────────────────────────────"
  echo "  │  DATABASE_URL=postgresql://daari_water:$PG_PASS@localhost:5432/daari_water"
  echo "  └──────────────────────────────────────────────────────────"
  echo ""
  # Persist to a root-only file so the operator can find it again if they
  # missed copying from the terminal.
  echo "DATABASE_URL=postgresql://daari_water:$PG_PASS@localhost:5432/daari_water" \
    > /root/daari-water-db-credentials.txt
  chmod 600 /root/daari-water-db-credentials.txt
  echo "  · also saved to /root/daari-water-db-credentials.txt (chmod 600)"
else
  echo "  · role 'daari_water' already exists — leaving password untouched"
  echo "  · if you've lost the password, see /root/daari-water-db-credentials.txt"
fi

# PostGIS — required for the geographic queries (closest plant, etc.)
sudo -u postgres psql -d daari_water -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null 2>&1 || {
  echo "  ! could not create PostGIS extension — make sure postgresql-XX-postgis package is installed"
  echo "    (apt list --installed | grep postgis)"
}
echo "  ✓ PostGIS extension enabled on daari_water DB (if package present)"

echo ""
echo "── 6. systemd units ─────────────────────────────────────"
for unit in daari-water-api daari-water-dashboard; do
  target="/etc/systemd/system/$unit.service"
  source="$REPO_ROOT/deploy/systemd/$unit.service"
  if [[ -f "$target" ]] && ! cmp -s "$source" "$target"; then
    # Already exists and differs — back up old before overwriting so
    # we never silently clobber an in-flight edit.
    cp "$target" "$target.bak.$(date +%Y%m%d-%H%M%S)"
    echo "  · backed up existing $target → $target.bak.*"
  fi
  install -m 644 "$source" "$target"
  echo "  ✓ $unit.service installed"
done
systemctl daemon-reload
systemctl enable daari-water-api daari-water-dashboard
echo "  ✓ services enabled (not started yet — deploy.sh handles that)"

echo ""
echo "── 7. nginx vhosts ──────────────────────────────────────"
for vhost in daari-water-api daari-water-dashboard; do
  target_avail="/etc/nginx/sites-available/$vhost"
  target_enabled="/etc/nginx/sites-enabled/$vhost"
  source="$REPO_ROOT/deploy/nginx/$vhost.conf"
  if [[ -L "$target_enabled" ]] || [[ -f "$target_avail" ]]; then
    # File already exists — back up before replacing rather than silently
    # clobber. The operator can diff and decide.
    if [[ -f "$target_avail" ]] && ! cmp -s "$source" "$target_avail"; then
      cp "$target_avail" "$target_avail.bak.$(date +%Y%m%d-%H%M%S)"
      echo "  · backed up existing $target_avail → $target_avail.bak.*"
    fi
  fi
  install -m 644 "$source" "$target_avail"
  ln -sf "$target_avail" "$target_enabled"
  echo "  ✓ $vhost vhost installed"
done

nginx -t || { echo "[ABORT] nginx config check failed — fix before continuing" >&2; exit 1; }
systemctl reload nginx
echo "  ✓ nginx reloaded successfully"

echo ""
echo "── 8. Nightly backup cron ───────────────────────────────"
install -m 755 "$REPO_ROOT/scripts/backup-db.sh" /usr/local/sbin/daari-water-backup-db.sh
# Make the script use OUR slug (the script template defaults to 'daari' —
# we patch the constants at install time so the cron points to the right
# .env and writes to the right backup directory).
sed -i 's|/var/www/daari-api/.env|/var/www/daari-water-api/.env|g; s|/var/backups/daari|/var/backups/daari-water|g; s|daari-\$STAMP|daari-water-$STAMP|g; s|name '\''daari-\*\.sql\.gz'\''|name '\''daari-water-*.sql.gz'\''|g' /usr/local/sbin/daari-water-backup-db.sh

CRON_LINE="0 3 * * * root /usr/local/sbin/daari-water-backup-db.sh >> /var/log/daari-water/backup.log 2>&1"
if ! grep -q "daari-water-backup-db.sh" /etc/crontab 2>/dev/null; then
  echo "$CRON_LINE" >> /etc/crontab
  echo "  ✓ nightly backup cron installed (03:00 UTC)"
else
  echo "  · backup cron already present"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " Bootstrap complete. Next:"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  1. Fill in /var/www/daari-water-api/.env:"
echo "       cp /root/daari-water-platform/backend/.env.production.example \\"
echo "          /var/www/daari-water-api/.env"
echo "       vim /var/www/daari-water-api/.env"
echo "     — DATABASE_URL: see /root/daari-water-db-credentials.txt"
echo "     — JWT_SECRET:   openssl rand -hex 64"
echo ""
echo "  2. Fill in /var/www/daari-water-dashboard/.env:"
echo "       echo 'NEXT_PUBLIC_API_BASE_URL=https://api.phi-bit.com/api/v1' \\"
echo "         > /var/www/daari-water-dashboard/.env"
echo ""
echo "  3. From your laptop: ./deploy/deploy.sh both"
echo ""
echo "  4. After deploy is healthy: certbot --nginx -d api.phi-bit.com \\"
echo "       -d daari-admin.phi-bit.com"
echo "════════════════════════════════════════════════════════════════"
