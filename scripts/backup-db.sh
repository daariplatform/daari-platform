#!/usr/bin/env bash
#
# Daari — nightly Postgres backup with rotation + S3 upload.
#
# Designed to be installed at /usr/local/sbin/daari-backup-db.sh on the
# VPS and invoked from cron at 03:00 local time. Keeps 7 days of local
# snapshots and pushes a copy to S3 with a 30-day retention policy on
# the bucket side.
#
# Configure via /var/www/daari-api/.env on the VPS (same file the
# backend reads):
#   DATABASE_URL=postgresql://daari:PASS@localhost:5432/daari
#   S3_ENDPOINT=...
#   S3_BUCKET=daari-backups
#   S3_ACCESS_KEY=...
#   S3_SECRET_KEY=...
#
# Cron line (in /etc/crontab):
#   0 3 * * * root /usr/local/sbin/daari-backup-db.sh >> /var/log/daari-backup.log 2>&1

set -euo pipefail

ENV_FILE="${ENV_FILE:-/var/www/daari-api/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/daari}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERR] $ENV_FILE not found" >&2
  exit 1
fi

# Source DATABASE_URL + S3 creds. Cron has no shell env so we must export
# every key the rest of the script touches.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP=$(date -u '+%Y-%m-%dT%H-%M-%SZ')
DUMP_FILE="$BACKUP_DIR/daari-$STAMP.sql.gz"

echo "[$STAMP] starting daari backup -> $DUMP_FILE"

# --format=plain + gzip keeps it human-inspectable. If the DB grows past
# a couple of GB we should switch to --format=custom + pg_restore.
pg_dump --no-owner --no-privileges --clean --if-exists "$DATABASE_URL" \
  | gzip -9 > "$DUMP_FILE"

SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "[$STAMP] dump complete ($SIZE)"

# Rotate local snapshots — keep the newest $RETENTION_DAYS files.
find "$BACKUP_DIR" -name 'daari-*.sql.gz' -type f -mtime "+$RETENTION_DAYS" -delete

# Mirror to S3 if credentials are configured. Done last so a missing key
# doesn't break the local backup.
if [[ -n "${S3_ACCESS_KEY:-}" && -n "${S3_SECRET_KEY:-}" && -n "${S3_BUCKET:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "[WARN] aws-cli missing — skipping S3 upload" >&2
  else
    AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" \
    AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
    aws --endpoint-url "${S3_ENDPOINT:-https://fra1.digitaloceanspaces.com}" \
        s3 cp "$DUMP_FILE" "s3://$S3_BUCKET/$(basename "$DUMP_FILE")"
    echo "[$STAMP] uploaded to s3://$S3_BUCKET/"
  fi
fi

echo "[$STAMP] done"
