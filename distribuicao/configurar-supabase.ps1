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
# The access token lives only in this terminal session, so another Supabase
# account already logged in on this PC (another app) is not touched.
Write-Host "Precisa de um Access Token PESSOAL (começa por sbp_, 44 caracteres):"
Write-Host "  https://supabase.com/dashboard/account/tokens  ->  Generate new token"
Write-Host "  (NÃO serve a anon key, service_role nem sb_secret das definições do projeto)"
for ($try = 1; -not ($env:SUPABASE_ACCESS_TOKEN -match '^sbp_[0-9a-f]{40}$'); $try++) {
  if ($try -gt 3) { throw "Chave inválida 3 vezes. Gere um Access Token novo e volte a correr o script." }
  Write-Host "`nCole o token aqui (não aparece no ecrã) e carregue Enter:"
  $sec = Read-Host -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $tok = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  if ($tok -match '^sbp_[0-9a-f]{40}$') {
    $env:SUPABASE_ACCESS_TOKEN = $tok
  } else {
    $kind = if ($tok.StartsWith('eyJ')) { 'uma chave de API do projeto (anon/service_role)' }
            elseif ($tok.StartsWith('sb_')) { 'uma chave de API do projeto (sb_publishable/sb_secret)' }
            elseif ($tok.Length -eq 0) { 'vazio' }
            else { "texto com $($tok.Length) caracteres" }
    Write-Host "Isso não é um Access Token pessoal (parece $kind). Tente de novo." -ForegroundColor Yellow
  }
}
$ErrorActionPreference = "Continue"   # the CLI writes progress to stderr
$projects = (& npx -y supabase@latest projects list 2>&1) | Out-String
$ErrorActionPreference = "Stop"
if ($projects -notmatch $ProjectRef) {
  throw "Esta chave não dá acesso ao projeto $ProjectRef. Confirme que criou a chave com a conta da TreinON."
}
Write-Host "OK: projeto $ProjectRef encontrado nesta conta." -ForegroundColor Green

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
