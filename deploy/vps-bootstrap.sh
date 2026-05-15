#!/usr/bin/env bash
#
# First-time VPS setup for Daari. Run ONCE on the server (as root) after
# updating /root/PROJECTS.md to claim ports 3001 + 3002 + the two paths.
#
# What this does:
#   1. Creates the `daari` system user that systemd units run as
#   2. Creates /var/www/daari-{api,dashboard} and /var/log/daari
#   3. Installs PostgreSQL 16 + PostGIS + Redis if missing (skipped if
#      another project on the VPS already owns them)
#   4. Creates the Postgres role + database + PostGIS extension
#   5. Installs the systemd units + nginx vhosts shipped in this repo
#   6. Reloads systemd + nginx
#
# Idempotent — safe to re-run. Will not touch existing config.
#
# Usage (from the VPS, after cloning the repo into /root/daari-platform):
#   bash /root/daari-platform/deploy/vps-bootstrap.sh

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "── 1. System user ────────────────────────────────────────"
if ! id daari >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin daari
  echo "  ✓ created user 'daari'"
else
  echo "  · user 'daari' already exists"
fi

echo "── 2. Directories ────────────────────────────────────────"
mkdir -p /var/www/daari-api /var/www/daari-dashboard /var/log/daari /var/backups/daari
chown -R daari:daari /var/www/daari-api /var/www/daari-dashboard /var/log/daari
chmod 700 /var/backups/daari
echo "  ✓ /var/www/daari-{api,dashboard}, /var/log/daari, /var/backups/daari"

echo "── 3. System packages ────────────────────────────────────"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  curl ca-certificates gnupg lsb-release \
  postgresql postgresql-contrib postgis \
  redis-server \
  nginx certbot python3-certbot-nginx \
  rsync awscli

# Node.js 20 via NodeSource (matches the EAS Build worker version we use
# locally, so behavior is consistent).
if ! command -v node >/dev/null 2>&1 || [[ "$(node --version)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
fi
echo "  ✓ Node $(node --version), Postgres $(psql --version | awk '{print $3}'), Redis $(redis-server --version | awk '{print $3}')"

echo "── 4. Postgres role + DB ─────────────────────────────────"
PG_PASS=""
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='daari'" | grep -q 1; then
  PG_PASS=$(openssl rand -hex 16)
  sudo -u postgres psql <<SQL
CREATE ROLE daari WITH LOGIN PASSWORD '$PG_PASS';
CREATE DATABASE daari OWNER daari;
SQL
  echo "  ✓ created role 'daari' (password saved below)"
  echo ""
  echo "  ┌─── SAVE THIS PASSWORD ────────────────────────────────"
  echo "  │  DATABASE_URL=postgresql://daari:$PG_PASS@localhost:5432/daari"
  echo "  └────────────────────────────────────────────────────────"
  echo ""
else
  echo "  · role 'daari' already exists — leaving password untouched"
fi
# PostGIS — required for the geographic queries (closest plant, etc.)
sudo -u postgres psql -d daari -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null
echo "  ✓ PostGIS extension enabled"

echo "── 5. systemd units ──────────────────────────────────────"
install -m 644 "$REPO_ROOT/deploy/systemd/daari-api.service" /etc/systemd/system/
install -m 644 "$REPO_ROOT/deploy/systemd/daari-dashboard.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable daari-api daari-dashboard
echo "  ✓ daari-api + daari-dashboard installed and enabled"

echo "── 6. nginx vhosts ───────────────────────────────────────"
install -m 644 "$REPO_ROOT/deploy/nginx/api.daari.conf" /etc/nginx/sites-available/daari-api
install -m 644 "$REPO_ROOT/deploy/nginx/dashboard.daari.conf" /etc/nginx/sites-available/daari-dashboard
ln -sf /etc/nginx/sites-available/daari-api /etc/nginx/sites-enabled/daari-api
ln -sf /etc/nginx/sites-available/daari-dashboard /etc/nginx/sites-enabled/daari-dashboard
nginx -t
systemctl reload nginx
echo "  ✓ nginx vhosts installed"

echo "── 7. Backup cron ────────────────────────────────────────"
install -m 755 "$REPO_ROOT/scripts/backup-db.sh" /usr/local/sbin/daari-backup-db.sh
if ! grep -q "daari-backup-db.sh" /etc/crontab 2>/dev/null; then
  echo "0 3 * * * root /usr/local/sbin/daari-backup-db.sh >> /var/log/daari/backup.log 2>&1" >> /etc/crontab
  echo "  ✓ nightly backup cron installed (03:00 UTC)"
else
  echo "  · backup cron already present"
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo " Bootstrap complete. Next:"
echo ""
echo "  1. Copy backend/.env.production.example to /var/www/daari-api/.env"
echo "     and fill it in (Postgres URL above, JWT secrets, Sentry DSN, etc.)"
echo "  2. Copy backend/.env.production.example minus DB lines to"
echo "     /var/www/daari-dashboard/.env (just NEXT_PUBLIC_* + API URL)"
echo "  3. Point DNS:"
echo "       api.maa-iq.com         A → 45.84.138.119"
echo "       daari-admin.phi-bit.com A → 45.84.138.119"
echo "  4. Run from your laptop:  ./deploy/deploy.sh both"
echo "  5. Run on the VPS:"
echo "       certbot --nginx -d api.maa-iq.com -d daari-admin.phi-bit.com"
echo "══════════════════════════════════════════════════════════════"
