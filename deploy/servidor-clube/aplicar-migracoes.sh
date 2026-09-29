#!/usr/bin/env bash
# Applies TreinON migrations that are not yet in this database (safe to re-run;
# used on install and on every update).
set -euo pipefail
STACK="${1:-/opt/treinon/supabase}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$(cd "$HERE/../../supabase/migrations" && pwd)"
cd "$STACK"

psql_db() { docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X "$@"; }

psql_db -c "CREATE SCHEMA IF NOT EXISTS treinon_meta;
            CREATE TABLE IF NOT EXISTS treinon_meta.applied_migrations (
              version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

applied=0
for f in $(ls "$MIGRATIONS"/*.sql | sort); do
  v="$(basename "$f" .sql)"
  done_already=$(psql_db -t -A -c "SELECT 1 FROM treinon_meta.applied_migrations WHERE version = '$v'")
  [ "$done_already" = "1" ] && continue
  echo "  -> $v"
  { cat "$f"; printf "\nINSERT INTO treinon_meta.applied_migrations(version) VALUES ('%s');\n" "$v"; } \
    | psql_db -1 -f -
  applied=$((applied + 1))
done
echo "[TreinON] Migrações novas aplicadas: $applied"
