#!/bin/sh
set -eu

# Keys come from the environment (Secret Manager) when set; otherwise generated per instance.
gen() { node -e "process.stdout.write(require('crypto').randomBytes($1).toString('hex'))"; }
export FIELD_ENCRYPTION_KEY="${FIELD_ENCRYPTION_KEY:-$(gen 32)}"
export IP_HASH_SALT="${IP_HASH_SALT:-$(gen 24)}"
export SESSION_SECRET="${SESSION_SECRET:-$(gen 32)}"

if [ -n "${DATABASE_URL:-}" ]; then
  # Persistent mode A: an external PostgreSQL (with pgvector) is configured. Nothing is stored in the container.
  echo "Using external database (DATABASE_URL)."
  npm run db:migrate
  npm run db:seed   # idempotent: inserts only what is missing
  (npm run kb:reindex -- --soft >/dev/null 2>&1 &) || true
  exec ./node_modules/.bin/tsx server.ts
fi

# Embedded PostgreSQL. With STATE_BUCKET set, snapshots (pg_dump) are kept in Cloud Storage and restored on start.
PGBIN=/usr/lib/postgresql/16/bin
PGDATA=/tmp/pgdata
BUCKET="${STATE_BUCKET:-}"
SNAP=/tmp/wijaha.dump

token() { curl -sf -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'; }
snap_get() { curl -sf -H "Authorization: Bearer $(token)" "https://storage.googleapis.com/storage/v1/b/$BUCKET/o/wijaha.dump?alt=media" -o "$SNAP"; }
snap_put() { curl -sf -X POST -H "Authorization: Bearer $(token)" -H "Content-Type: application/octet-stream" --data-binary @"$SNAP" "https://storage.googleapis.com/upload/storage/v1/b/$BUCKET/o?uploadType=media&name=wijaha.dump" >/dev/null; }
dump_db() {
  $PGBIN/pg_dump -h 127.0.0.1 -U postgres -Fc wijaha -f "$SNAP.tmp" && mv "$SNAP.tmp" "$SNAP" && snap_put \
    && echo "snapshot saved ($(wc -c < "$SNAP") bytes)" || echo "snapshot FAILED" >&2
}

mkdir -p "$PGDATA" && chown postgres:postgres "$PGDATA" && chmod 700 "$PGDATA"
su postgres -c "$PGBIN/initdb -D $PGDATA -A trust -E UTF8 >/dev/null"
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1 -c fsync=off -c max_connections=40' -w -s start"

PSQL="$PGBIN/psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "CREATE DATABASE wijaha"
$PSQL -c "CREATE ROLE app_user LOGIN PASSWORD 'preview' NOSUPERUSER NOBYPASSRLS"

RESTORED=0
if [ -n "$BUCKET" ] && snap_get; then
  # The dump carries the vector extension; errors on pre-existing objects are tolerated, then we verify the data.
  $PGBIN/pg_restore -h 127.0.0.1 -U postgres -d wijaha --no-owner --no-acl "$SNAP" >/dev/null 2>&1 || true
  if [ "$($PSQL -At -d wijaha -c "select count(*) from knowledge_rules" 2>/dev/null || echo 0)" -gt 0 ]; then
    RESTORED=1
    echo "Restored snapshot from gs://$BUCKET/wijaha.dump"
  else
    echo "Snapshot unusable; rebuilding from scratch" >&2
    $PSQL -c "DROP DATABASE wijaha" && $PSQL -c "CREATE DATABASE wijaha"
  fi
fi
[ "$RESTORED" = 1 ] || $PSQL -d wijaha -c "CREATE EXTENSION IF NOT EXISTS vector"

npm run db:migrate
$PSQL -d wijaha -c "GRANT USAGE ON SCHEMA public TO app_user; GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user;"
SQL_USER=postgres npm run db:seed   # idempotent: adds what is missing; never overwrites reviewed or edited rules
$PSQL -d wijaha -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user;"

./node_modules/.bin/tsx server.ts &
SERVER_PID=$!

if [ -n "$BUCKET" ]; then
  dump_db
  (
    last="$($PSQL -At -d wijaha -c "select coalesce(sum(tup_inserted+tup_updated+tup_deleted),0) from pg_stat_database where datname='wijaha'")"
    while true; do
      sleep 45
      now="$($PSQL -At -d wijaha -c "select coalesce(sum(tup_inserted+tup_updated+tup_deleted),0) from pg_stat_database where datname='wijaha'" 2>/dev/null || echo "$last")"
      if [ "$now" != "$last" ]; then dump_db && last="$now"; fi
    done
  ) &
  DUMPER_PID=$!
fi

shutdown() {
  echo "SIGTERM: final snapshot"
  [ -n "$BUCKET" ] && { kill "$DUMPER_PID" 2>/dev/null || true; dump_db; }
  kill "$SERVER_PID" 2>/dev/null || true
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -m fast -w stop" >/dev/null 2>&1 || true
  exit 0
}
trap shutdown TERM INT
wait "$SERVER_PID"
