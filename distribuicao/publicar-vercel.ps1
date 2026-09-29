# TreinON — publicar a app no Vercel e ligar à Supabase
# Uso (PowerShell, na pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File distribuicao\publicar-vercel.ps1 -ProjectRef onlwidkjkcvojdwisjdj
#
# Os tokens ficam só nesta janela do terminal (não mexe noutras contas do PC).

param(
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [string]$VercelProject = "treinon",
  # Vercel team slug (vercel.com/<slug>); empty = the token's default team
  [string]$Scope = "",
  [string]$SupportEmail = "treinon.apoio@gmail.com",
  # Only publish a new version of the app (Vercel token only; Supabase untouched)
  [switch]$SoApp
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Read-Secret([string]$prompt) {
  Write-Host $prompt
  $sec = Read-Host -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Run {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest)
  & npx -y @Rest
  if ($LASTEXITCODE -ne 0) { throw "Falhou: $Rest" }
}

$ScopeArgs = @()
if ($Scope) { $ScopeArgs = @("--scope", $Scope) }

# ── 1. Tokens ────────────────────────────────────────────────────────────────
Write-Host "`n[1/5] Chaves de acesso" -ForegroundColor Cyan
while (-not $SoApp -and -not ($env:SUPABASE_ACCESS_TOKEN -match '^sbp_[0-9a-f]{40}$')) {
  $t = Read-Secret "Access Token da Supabase (sbp_..., https://supabase.com/dashboard/account/tokens):"
  if ($t -match '^sbp_[0-9a-f]{40}$') { $env:SUPABASE_ACCESS_TOKEN = $t } else { Write-Host "Não parece um Access Token (sbp_...)." -ForegroundColor Yellow }
}
$VercelToken = ""
while ($VercelToken.Length -lt 20) {
  $VercelToken = Read-Secret "Token do Vercel (https://vercel.com/account/settings/tokens -> Create, entrando com a conta da TreinON):"
  if ($VercelToken.Length -lt 20) { Write-Host "Token demasiado curto; copie-o outra vez." -ForegroundColor Yellow }
}

if ($SoApp) {
  # Vercel already has the variables; make sure this folder is linked to the project
  if (-not (Test-Path .vercel\project.json)) { Run vercel@latest link --yes --project $VercelProject --token $VercelToken @ScopeArgs }
} else {
# ── 2. Chave pública da Supabase ─────────────────────────────────────────────
Write-Host "`n[2/5] A obter a chave pública do projeto $ProjectRef..." -ForegroundColor Cyan
$SupabaseUrl = "https://$ProjectRef.supabase.co"
$apiHeaders = @{ Authorization = "Bearer $($env:SUPABASE_ACCESS_TOKEN)" }
$keys = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ProjectRef/api-keys?reveal=true" -Headers $apiHeaders
$pub = $keys | Where-Object { $_.type -eq 'publishable' } | Select-Object -First 1
if (-not $pub) { $pub = $keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1 }
if (-not $pub) { throw "Não encontrei a chave pública (publishable/anon) do projeto." }
$AnonKey = $pub.api_key
Write-Host "OK: chave pública encontrada ($($AnonKey.Substring(0, 14))...)" -ForegroundColor Green

# Local .env also points to the new project (for development on this PC)
$envText = "VITE_SUPABASE_URL=$SupabaseUrl`nVITE_SUPABASE_PUBLISHABLE_KEY=$AnonKey`nVITE_SUPABASE_PROJECT_ID=$ProjectRef`nVITE_SUPPORT_EMAIL=$SupportEmail`n"
if ((Test-Path .env) -and -not (Test-Path ".env.lovable-antigo")) { Copy-Item .env ".env.lovable-antigo" }
[IO.File]::WriteAllText((Join-Path (Get-Location) ".env"), $envText, (New-Object System.Text.UTF8Encoding($false)))

# ── 3. Vercel: projeto e variáveis ───────────────────────────────────────────
Write-Host "`n[3/5] A preparar o projeto no Vercel..." -ForegroundColor Cyan
# Create the project first (an error just means it already exists), then link to it
$ErrorActionPreference = "Continue"
& npx -y vercel@latest project add $VercelProject --token $VercelToken @ScopeArgs 2>&1 | Out-Host
$ErrorActionPreference = "Stop"
Run vercel@latest link --yes --project $VercelProject --token $VercelToken @ScopeArgs
$vars = [ordered]@{
  VITE_SUPABASE_URL = $SupabaseUrl
  VITE_SUPABASE_PUBLISHABLE_KEY = $AnonKey
  VITE_SUPABASE_PROJECT_ID = $ProjectRef
  VITE_SUPPORT_EMAIL = $SupportEmail
}
foreach ($k in $vars.Keys) {
  $ErrorActionPreference = "Continue"
  & npx -y vercel@latest env rm $k production --yes --token $VercelToken @ScopeArgs 2>&1 | Out-Null
  $ErrorActionPreference = "Stop"
  $vars[$k] | & npx -y vercel@latest env add $k production --token $VercelToken @ScopeArgs
  if ($LASTEXITCODE -ne 0) { throw "Falhou a variável $k" }
}
}

# ── 4. Publicar ──────────────────────────────────────────────────────────────
Write-Host "`n[4/5] A publicar (demora 1–2 minutos)..." -ForegroundColor Cyan
$ErrorActionPreference = "Continue"   # vercel prints progress on stderr
$out = (& npx -y vercel@latest deploy --prod --yes --token $VercelToken @ScopeArgs 2>&1) | Out-String
$code = $LASTEXITCODE
$ErrorActionPreference = "Stop"
Write-Host $out
if ($code -ne 0) { throw "O Vercel não conseguiu publicar (ver mensagens acima)." }
$alias = [regex]::Match($out, 'Aliased:\s*(https://[^\s\]]+)').Groups[1].Value
if (-not $alias) { $alias = "https://$VercelProject.vercel.app" }
$AppUrl = $alias.TrimEnd('/')

if ($SoApp) {
  Write-Host "`nNova versão publicada!  ->  $AppUrl`nOs telemóveis recebem-na ao reabrir a app." -ForegroundColor Green
  exit 0
}

# ── 5. Supabase: endereço da app, CORS e contas ─────────────────────────────
Write-Host "`n[5/5] A ligar a Supabase ao endereço $AppUrl..." -ForegroundColor Cyan
$authCfg = @{
  site_url = $AppUrl
  uri_allow_list = "$AppUrl/**,http://localhost:8080/**,http://localhost:4173/**"
  # Until a custom SMTP is set up, Supabase only emails the project's own team,
  # so confirmation emails would never reach coaches/parents: activate on sign-up.
  mailer_autoconfirm = $true
} | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "https://api.supabase.com/v1/projects/$ProjectRef/config/auth" `
  -Headers $apiHeaders -ContentType "application/json" -Body $authCfg | Out-Null
Run supabase@latest secrets set --project-ref $ProjectRef "APP_URL=$AppUrl" "ALLOWED_ORIGINS=$AppUrl,http://localhost:8080,http://localhost:4173"

Write-Host @"

TreinON publicada!  ->  $AppUrl

Falta só (painel da Supabase):
  Authentication > Rate Limits > "sign-ups and sign-ins": subir para 300
"@ -ForegroundColor Green
