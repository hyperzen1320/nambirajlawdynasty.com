#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Nightly MongoDB backup for the self-hosted LegalEasy stack.
#
# Dumps the database OUT of the running `mongo` container into a dated,
# gzipped archive on the host, then prunes archives older than RETENTION
# days. Atlas used to do this automatically — self-hosting makes it your
# job, and for confidential client case-data it is NOT optional.
#
# IMPORTANT: a backup that lives only on the same machine does not
# survive that machine dying. Also copy these archives off the server —
# another disk, a NAS, or an encrypted bucket. Encrypt at rest; this is
# privileged legal data.
#
# Install (runs nightly at 02:30):
#   chmod +x scripts/backup-mongo.sh
#   crontab -e
#   30 2 * * *  /opt/legaleasy/scripts/backup-mongo.sh >> /var/log/legaleasy-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# --- config (override via env if your names differ) ------------------
# Container name under docker compose v2 is "<project>-mongo-1"; the
# project defaults to the directory name. Confirm yours with:
#   docker compose ps --format '{{.Name}}'
CONTAINER="${MONGO_CONTAINER:-legaleasy-mongo-1}"
DB="${MONGODB_DB:-legaleasy}"
DEST="${BACKUP_DIR:-/opt/legaleasy/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"
archive="$DEST/legaleasy-$DB-$stamp.archive.gz"

echo "[$(date -Is)] dumping '$DB' from container '$CONTAINER' → $archive"
# --archive (no value) streams the dump to stdout; we capture it on the
# host so the backup lives outside the container's volume.
docker exec "$CONTAINER" \
  mongodump --db="$DB" --archive --gzip \
  > "$archive"

# Fail loudly if the archive came out empty (e.g. wrong container name).
if [ ! -s "$archive" ]; then
  echo "[$(date -Is)] ERROR: backup is empty — check MONGO_CONTAINER/DB" >&2
  rm -f "$archive"
  exit 1
fi

echo "[$(date -Is)] pruning archives older than ${RETENTION_DAYS}d"
find "$DEST" -name 'legaleasy-*.archive.gz' -type f \
  -mtime "+${RETENTION_DAYS}" -print -delete

echo "[$(date -Is)] done — $(du -h "$archive" | cut -f1) written"
