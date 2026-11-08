#!/bin/sh
set -e

# Ensure the mounted data directory is writable by the runtime user, then drop
# privileges. Railway volumes are commonly mounted as root, which would
# otherwise break SQLite for the non-root process.
DATA_FILE="${MARKETPLACE_DB_PATH:-/app/.data/marketplace.db}"
DATA_DIR="$(dirname "$DATA_FILE")"
mkdir -p "$DATA_DIR"
chown -R node:node "$DATA_DIR" 2>/dev/null || true

exec su-exec node "$@"
