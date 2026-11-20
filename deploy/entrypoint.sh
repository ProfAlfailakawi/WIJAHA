#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  # Persistent mode: an external PostgreSQL (with pgvector) is configured. Nothing is stored in the container.
  echo "Using external database (DATABASE_URL)."
  npm run db:migrate
  # Idempotent: inserts only what is missing (rules, sources, scenarios, demo users).
  npm run db:seed
else
  # Ephemeral preview mode: embedded PostgreSQL, re-seeded on every cold start.
  PGBIN=/usr/lib/postgresql/16/bin
  PGDATA=/tmp/pgdata

  mkdir -p "$PGDATA" && chown postgres:postgres "$PGDATA" && chmod 700 "$PGDATA"
  su postgres -c "$PGBIN/initdb -D $PGDATA -A trust -E UTF8 >/dev/null"
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1 -c fsync=off -c max_connections=40' -w -s start"

  PSQL="$PGBIN/psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 -q"
  $PSQL -c "CREATE DATABASE wijaha"
  $PSQL -d wijaha -c "CREATE EXTENSION IF NOT EXISTS vector"
  $PSQL -d wijaha -c "CREATE ROLE app_user LOGIN PASSWORD 'preview' NOSUPERUSER NOBYPASSRLS"

  npm run db:migrate
  $PSQL -d wijaha -c "GRANT USAGE ON SCHEMA public TO app_user; GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user;"
  SQL_USER=postgres npm run db:seed
fi

# Keys come from the environment (Secret Manager) when set; otherwise generated per instance.
gen() { node -e "process.stdout.write(require('crypto').randomBytes($1).toString('hex'))"; }
export FIELD_ENCRYPTION_KEY="${FIELD_ENCRYPTION_KEY:-$(gen 32)}"
export IP_HASH_SALT="${IP_HASH_SALT:-$(gen 24)}"
export SESSION_SECRET="${SESSION_SECRET:-$(gen 32)}"
exec npx tsx server.ts
