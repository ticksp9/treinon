#!/usr/bin/env bash
# TreinON — instalação no servidor do clube (Linux com Docker).
#
#   sudo ./deploy/servidor-clube/instalar.sh treinon.meuclube.pt            # domínio público (recomendado)
#   sudo ./deploy/servidor-clube/instalar.sh treinon.local --interno         # só na rede do clube
#
# Instala a Supabase oficial (self-hosted) + TreinON num único endereço HTTPS,
# cria a base de dados (todas as migrações) e publica as funções do servidor.
set -euo pipefail

DOMAIN="${1:-}"
MODE="${2:-}"
[ -n "$DOMAIN" ] || { echo "Uso: $0 <dominio> [--interno]"; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$(cd "$HERE/../.." && pwd)"
BASE="${TREINON_HOME:-/opt/treinon}"
STACK="$BASE/supabase"
SUPABASE_REF="${SUPABASE_REF:-master}"   # pode fixar uma versão, p.ex. SUPABASE_REF=v1.25.04

say() { printf '\n\033[1;36m[TreinON]\033[0m %s\n' "$*"; }

command -v docker >/dev/null || { echo "Instale o Docker primeiro: https://docs.docker.com/engine/install/"; exit 1; }
docker compose version >/dev/null || { echo "Falta o 'docker compose' (plugin v2)."; exit 1; }
command -v openssl >/dev/null || { echo "Falta o openssl."; exit 1; }
command -v git >/dev/null || { echo "Falta o git."; exit 1; }

# ── 1. Supabase oficial ──────────────────────────────────────────────────────
if [ ! -f "$STACK/docker-compose.yml" ]; then
  say "A descarregar a Supabase self-hosted ($SUPABASE_REF)..."
  tmp="$(mktemp -d)"
  git clone --depth 1 --branch "$SUPABASE_REF" https://github.com/supabase/supabase "$tmp/supabase"
  mkdir -p "$BASE"
  cp -r "$tmp/supabase/docker" "$STACK"
  rm -rf "$tmp"
fi
cd "$STACK"

# ── 2. Segredos (só na primeira instalação) ─────────────────────────────────
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() { # $1 role, $2 secret
  local now exp header payload sig
  now=$(date +%s); exp=$((now + 10*365*24*3600))
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$now" "$exp" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$2" -binary | b64url)
  printf '%s.%s.%s' "$header" "$payload" "$sig"
}
rand() { openssl rand -hex "${1:-32}"; }
set_env() { # KEY VALUE — replaces the line if the key exists, appends otherwise
  local k="$1" v="$2"
  if grep -q "^${k}=" .env; then
    local esc; esc=$(printf '%s' "$v" | sed -e 's/[\/&|]/\\&/g')
    sed -i "s|^${k}=.*|${k}=${esc}|" .env
  else
    printf '%s=%s\n' "$k" "$v" >> .env
  fi
}

if [ ! -f .env ]; then
  say "A gerar chaves e palavras-passe..."
  cp .env.example .env
  JWT_SECRET=$(rand 32)
  set_env POSTGRES_PASSWORD "$(rand 24)"
  set_env JWT_SECRET "$JWT_SECRET"
  set_env ANON_KEY "$(jwt anon "$JWT_SECRET")"
  set_env SERVICE_ROLE_KEY "$(jwt service_role "$JWT_SECRET")"
  set_env DASHBOARD_USERNAME "admin"
  set_env DASHBOARD_PASSWORD "$(rand 16)"
  set_env SECRET_KEY_BASE "$(rand 32)"
  set_env VAULT_ENC_KEY "$(rand 16)"
  grep -q '^PG_META_CRYPTO_KEY=' .env && set_env PG_META_CRYPTO_KEY "$(rand 16)"
  grep -q '^LOGFLARE_PUBLIC_ACCESS_TOKEN=' .env && set_env LOGFLARE_PUBLIC_ACCESS_TOKEN "$(rand 24)"
  grep -q '^LOGFLARE_PRIVATE_ACCESS_TOKEN=' .env && set_env LOGFLARE_PRIVATE_ACCESS_TOKEN "$(rand 24)"
  chmod 600 .env
fi

set_env TREINON_SRC "$SRC"
set_env TREINON_DOMAIN "$DOMAIN"
set_env SITE_URL "https://$DOMAIN"
set_env API_EXTERNAL_URL "https://$DOMAIN"
set_env SUPABASE_PUBLIC_URL "https://$DOMAIN"
set_env ADDITIONAL_REDIRECT_URLS "https://$DOMAIN/**"
# Functions check the user themselves (and stripe-webhook uses its signature)
set_env FUNCTIONS_VERIFY_JWT "false"
if [ "$MODE" = "--interno" ]; then
  set_env TREINON_TLS_DIRECTIVE "tls internal"
else
  set_env TREINON_TLS_DIRECTIVE ""
fi
# Sem SMTP configurado as contas ficam ativas logo (clube privado).
if ! grep -q '^SMTP_HOST=.\+' .env || grep -q '^SMTP_HOST=supabase-mail' .env; then
  set_env ENABLE_EMAIL_AUTOCONFIRM "true"
fi

# ── 3. Ficheiros TreinON ────────────────────────────────────────────────────
cp "$HERE/docker-compose.treinon.yml" "$STACK/docker-compose.treinon.yml"
cp "$HERE/Caddyfile.treinon" "$STACK/Caddyfile.treinon"
"$HERE/publicar-funcoes.sh" "$STACK"

# ── 4. Arrancar ─────────────────────────────────────────────────────────────
say "A arrancar (a primeira vez demora alguns minutos)..."
docker compose -f docker-compose.yml -f docker-compose.treinon.yml pull --ignore-buildable 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.treinon.yml up -d --build

say "A aguardar a base de dados..."
for i in $(seq 1 60); do
  docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 3
done
sleep 10  # deixa a Supabase criar os esquemas auth/storage

# ── 5. Base de dados TreinON ────────────────────────────────────────────────
"$HERE/aplicar-migracoes.sh" "$STACK"
docker compose -f docker-compose.yml -f docker-compose.treinon.yml restart functions >/dev/null

# ── 6. Cópias de segurança diárias ──────────────────────────────────────────
if command -v crontab >/dev/null; then
  ( crontab -l 2>/dev/null | grep -v 'treinon-backup' ; \
    echo "30 3 * * * $HERE/backup.sh $STACK >> $BASE/backup.log 2>&1 # treinon-backup" ) | crontab -
fi

DASH_PASS=$(grep '^DASHBOARD_PASSWORD=' .env | cut -d= -f2-)
say "Instalado!"
cat <<EOF

  App TreinON ........ https://$DOMAIN
  Painel Supabase .... http://<IP-do-servidor>:8000   (só na rede do clube)
                       utilizador: admin   palavra-passe: $DASH_PASS
  Segredos ........... $STACK/.env   (guarde uma cópia em local seguro!)
  Cópias de segurança  diárias às 03:30 em $BASE/backups

EOF
[ "$MODE" = "--interno" ] && echo "  Modo interno: instale o certificado nos aparelhos (ver LEIA-ME.md)."
