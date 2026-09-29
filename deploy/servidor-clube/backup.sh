#!/usr/bin/env bash
# Daily database + files backup; keeps the last 14 days.
set -euo pipefail
STACK="${1:-/opt/treinon/supabase}"
OUT="$(dirname "$STACK")/backups"
KEEP_DAYS="${KEEP_DAYS:-14}"
stamp="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$OUT"
cd "$STACK"

docker compose exec -T db pg_dump -U postgres -d postgres -Fc --no-owner > "$OUT/treinon-db-$stamp.dump"
# Uploaded files (documents, photos, receipts)
tar -czf "$OUT/treinon-ficheiros-$stamp.tar.gz" -C "$STACK/volumes" storage 2>/dev/null || true
# Secrets are needed to restore — copy them too (keep this folder private!)
cp .env "$OUT/env-$stamp.bak" && chmod 600 "$OUT/env-$stamp.bak"

find "$OUT" -type f -mtime +"$KEEP_DAYS" -delete
echo "[TreinON] Cópia de segurança $stamp concluída em $OUT"
