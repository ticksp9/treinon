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

# Runs the Supabase CLI and stops the script if the step failed.
# (An explicit parameter is required: @args is not forwarded to npx.ps1.)
function Sb {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest)
  & npx -y supabase@latest @Rest
  if ($LASTEXITCODE -ne 0) { throw "Falhou: supabase $Rest" }
}

Write-Host "`n[1/5] Acesso à conta Supabase da TreinON" -ForegroundColor Cyan
# Tokens are only set for this process (another Supabase account on this PC is not
# touched) and, after the first time, read from the encrypted store (DPAPI).
. (Join-Path $PSScriptRoot "_segredos.ps1")
$env:SUPABASE_ACCESS_TOKEN = Get-TreinonToken 'supabase' `
  "Access Token PESSOAL da Supabase (sbp_..., https://supabase.com/dashboard/account/tokens):" `
  { param($x) $x -match '^sbp_[0-9a-f]{40}$' }
$ErrorActionPreference = "Continue"   # the CLI writes progress to stderr
$projects = (& npx -y supabase@latest projects list 2>&1) | Out-String
$ErrorActionPreference = "Stop"
if ($projects -notmatch $ProjectRef) {
  Remove-TreinonSecret 'supabase'
  throw "O token não dá acesso ao projeto $ProjectRef (expirado ou de outra conta; foi apagado). Volte a correr e cole um novo."
}
Write-Host "OK: projeto $ProjectRef encontrado nesta conta." -ForegroundColor Green

Write-Host "`n[2/5] Projeto $ProjectRef" -ForegroundColor Cyan
$cfgPath = Join-Path (Get-Location) "supabase\config.toml"
$cfg = [IO.File]::ReadAllText($cfgPath) -replace 'project_id = ".*"', "project_id = `"$ProjectRef`""
[IO.File]::WriteAllText($cfgPath, $cfg, (New-Object System.Text.UTF8Encoding($false)))  # no BOM (TOML)

Write-Host "`n[3/5] Base de dados (migrações em falta)..." -ForegroundColor Cyan
# Through the Management API: only the access token is needed, no database password
. (Join-Path $PSScriptRoot "_migracoes.ps1")
Sync-TreinonMigrations $ProjectRef $env:SUPABASE_ACCESS_TOKEN (Join-Path (Get-Location) "supabase\migrations")

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

Tudo configurado.
"@ -ForegroundColor Green
