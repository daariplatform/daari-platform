#!/usr/bin/env bash
#
# Daari — nightly Postgres backup with rotation + S3 upload.
#
# Designed to be installed at /usr/local/sbin/daari-backup-db.sh on the
# VPS and invoked from cron at 03:00 local time. Keeps 7 days of local
# snapshots and pushes a copy to S3 with a 30-day retention policy on
# the bucket side.
#
# Configure via /var/www/daari-water-api/.env on the VPS (same file the
# backend reads):
#   DATABASE_URL=postgresql://daari_water:PASS@localhost:5432/daari_water?schema=public
#   S3_ENDPOINT=...
#   S3_BUCKET=daari-backups
#   S3_ACCESS_KEY=...
#   S3_SECRET_KEY=...
#
# Cron line (in /etc/crontab):
#   0 3 * * * root /usr/local/sbin/daari-backup-db.sh >> /var/log/daari-backup.log 2>&1

set -euo pipefail

ENV_FILE="${ENV_FILE:-/var/www/daari-water-api/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/daari-water}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERR] $ENV_FILE not found" >&2
  exit 1
fi

# Read only the keys we need WITHOUT sourcing the file. The backend .env is a
# dotenv file, not a shell script: values with spaces, parentheses or '$'
# (e.g. an inline Firebase service-account JSON) would break `source`, and
# `set -a; source` would also leak every backend secret into the aws child
# process. env_get pulls one KEY=value, last match wins, quotes stripped.
env_get() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1 \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//"
}

DATABASE_URL="$(env_get DATABASE_URL)"
S3_ENDPOINT="$(env_get S3_ENDPOINT)"
S3_BUCKET="$(env_get S3_BUCKET)"
S3_ACCESS_KEY="$(env_get S3_ACCESS_KEY)"
S3_SECRET_KEY="$(env_get S3_SECRET_KEY)"

if [[ -z "$DATABASE_URL" ]]; then
  echo "[ERR] DATABASE_URL not found in $ENV_FILE" >&2
  exit 1
fi

# libpq (and thus pg_dump) rejects Prisma's ?schema=... query parameter with
# "invalid URI query parameter". The .env templates only ever set schema in
# the query string here, so strip the whole query part before connecting.
PG_CONN="${DATABASE_URL%%\?*}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP=$(date -u '+%Y-%m-%dT%H-%M-%SZ')
DUMP_FILE="$BACKUP_DIR/daari-$STAMP.sql.gz"
TMP_FILE="$DUMP_FILE.tmp"
# Clean up the temp file if any step below fails, so a failed run never leaves
# a valid-looking but truncated .sql.gz behind that rotation would later keep.
trap 'rm -f "$TMP_FILE"' EXIT

echo "[$STAMP] starting daari backup -> $DUMP_FILE"

# --format=plain + gzip keeps it human-inspectable. If the DB grows past
# a couple of GB we should switch to --format=custom + pg_restore.
pg_dump --no-owner --no-privileges --clean --if-exists "$PG_CONN" \
  | gzip -9 > "$TMP_FILE"

# Integrity + sanity checks before promoting the temp file. gzip -t catches a
# corrupt stream; the size floor catches a truncated-but-valid-gzip dump (a
# real schema+data dump is never this small).
gzip -t "$TMP_FILE"
MIN_BYTES=1024
ACTUAL_BYTES=$(wc -c < "$TMP_FILE")
if (( ACTUAL_BYTES < MIN_BYTES )); then
  echo "[ERR] dump is only $ACTUAL_BYTES bytes — treating as failure" >&2
  exit 1
fi

mv "$TMP_FILE" "$DUMP_FILE"
trap - EXIT

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
