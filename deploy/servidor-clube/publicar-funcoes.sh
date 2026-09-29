#!/usr/bin/env bash
# Copies TreinON edge functions into the self-hosted functions volume.
set -euo pipefail
STACK="${1:-/opt/treinon/supabase}"
HERE="$(cd "$(dirname "$0")" && pwd)"
FUNCS="$(cd "$HERE/../../supabase/functions" && pwd)"
DEST="$STACK/volumes/functions"

mkdir -p "$DEST"
# "main" (router) comes with Supabase and must stay; "mcp" is Lovable-only.
for d in "$FUNCS"/*/; do
  name="$(basename "$d")"
  [ "$name" = "mcp" ] && continue
  rm -rf "${DEST:?}/$name"
  cp -r "$d" "$DEST/$name"
done
echo "[TreinON] Funções copiadas para $DEST"
