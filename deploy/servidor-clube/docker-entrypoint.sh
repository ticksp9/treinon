#!/bin/sh
# Writes /config.js so the app talks to this club's own Supabase.
set -eu
: "${SUPABASE_PUBLIC_URL:?SUPABASE_PUBLIC_URL em falta}"
: "${ANON_KEY:?ANON_KEY em falta}"
cat > /usr/share/nginx/html/config.js <<EOF
window.__TREINON_CONFIG__ = { supabaseUrl: "${SUPABASE_PUBLIC_URL}", supabaseAnonKey: "${ANON_KEY}" };
EOF
echo "TreinON: config.js -> ${SUPABASE_PUBLIC_URL}"
