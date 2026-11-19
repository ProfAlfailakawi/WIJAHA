#!/bin/sh
set -eu
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

# Generated per instance: sessions are intentionally not shared across instances in preview.
export FIELD_ENCRYPTION_KEY="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
export IP_HASH_SALT="$(node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))")"
export SESSION_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
exec npx tsx server.ts
