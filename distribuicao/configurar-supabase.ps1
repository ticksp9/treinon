# TreinON — configurar um projeto Supabase novo
# Uso (PowerShell, na pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File distribuicao\configurar-supabase.ps1 -ProjectRef abcdefghijklmnop
#
# Faz: login na Supabase CLI, liga a pasta ao projeto, cria a base de dados (todas as
# migrações) e publica as funções do servidor. Os segredos pede-os no fim.

param(
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [string]$AppUrl = "https://treinon.vercel.app"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

# Runs the Supabase CLI and stops the script if the step failed
function Sb { npx -y supabase@latest @args; if ($LASTEXITCODE -ne 0) { throw "Falhou: supabase $args" } }

Write-Host "`n[1/5] Login na Supabase (abre o browser)..." -ForegroundColor Cyan
Sb login

Write-Host "`n[2/5] Ligar ao projeto $ProjectRef ..." -ForegroundColor Cyan
$cfgPath = Join-Path (Get-Location) "supabase\config.toml"
$cfg = [IO.File]::ReadAllText($cfgPath) -replace 'project_id = ".*"', "project_id = `"$ProjectRef`""
[IO.File]::WriteAllText($cfgPath, $cfg, (New-Object System.Text.UTF8Encoding($false)))  # no BOM (TOML)
Sb link --project-ref $ProjectRef

Write-Host "`n[3/5] Criar a base de dados (migrações)..." -ForegroundColor Cyan
Sb db push

Write-Host "`n[4/5] Publicar funções do servidor..." -ForegroundColor Cyan
$functions = @("auth-lookup", "verify-pin", "manage-invites", "send-invite", "billing-engine",
               "create-payment", "reconciliation-engine", "stripe-connect", "stripe-webhook",
               "fetch-fpf-standings")
foreach ($f in $functions) {
  Write-Host "  - $f"
  # --use-api: bundled on Supabase's side, no Docker needed
  Sb functions deploy $f --project-ref $ProjectRef --use-api
}

Write-Host "`n[5/5] Segredos das funções" -ForegroundColor Cyan
Sb secrets set --project-ref $ProjectRef "APP_URL=$AppUrl" "ALLOWED_ORIGINS=$AppUrl,http://localhost:8080"
Write-Host @"

Pronto. Opcional (só se usar estas funcionalidades):
  Emails de convite (Resend):  npx supabase secrets set RESEND_API_KEY=... EMAIL_FROM="TreinON <convites@SEU-DOMINIO>"
  SMS (Twilio):                npx supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=+351...
  Pagamentos (Stripe):         npx supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
  Classificações FPF:          npx supabase secrets set FIRECRAWL_API_KEY=...

Falta ainda no painel da Supabase (ver distribuicao\GUIA-SUPABASE-VERCEL.md):
  - Authentication > URL Configuration: Site URL = $AppUrl
  - Authentication > Rate Limits: subir "sign-ups and sign-ins"
"@ -ForegroundColor Green
