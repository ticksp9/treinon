#!/usr/bin/env bash
# Updates TreinON on the club server: new app version, new migrations, functions.
#   cd <pasta TreinON> && git pull && sudo ./deploy/servidor-clube/atualizar.sh
set -euo pipefail
STACK="${1:-${TREINON_HOME:-/opt/treinon}/supabase}"
HERE="$(cd "$(dirname "$0")" && pwd)"

"$HERE/backup.sh" "$STACK"                       # always back up before updating
cp "$HERE/docker-compose.treinon.yml" "$HERE/Caddyfile.treinon" "$STACK/"
"$HERE/publicar-funcoes.sh" "$STACK"
cd "$STACK"
docker compose -f docker-compose.yml -f docker-compose.treinon.yml up -d --build treinon-web caddy
"$HERE/aplicar-migracoes.sh" "$STACK"
docker compose -f docker-compose.yml -f docker-compose.treinon.yml restart functions >/dev/null
echo "[TreinON] Atualizado. Os aparelhos recebem a nova versão ao reabrir a app."
