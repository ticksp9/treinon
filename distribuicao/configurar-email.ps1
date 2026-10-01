# Liga o envio de convites por email (Brevo, plano gratuito: 300 emails/dia).
# Antes: criar conta em brevo.com com treinon.apoio@gmail.com, confirmar esse email
# como remetente (Senders) e criar uma chave em SMTP & API -> API Keys.
#   powershell -ExecutionPolicy Bypass -File distribuicao\configurar-email.ps1
param(
  [string]$ProjectRef = "onlwidkjkcvojdwisjdj",
  [string]$From = "TreinON <treinon.apoio@gmail.com>"
)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_segredos.ps1"

$token = Get-TreinonSecret 'supabase'
if (-not $token) { throw "Falta o token Supabase. Corra primeiro distribuicao\configurar-supabase.ps1" }

Write-Host "`nCole a chave API do Brevo (comeca por xkeysib-). Nao aparece no ecra." -ForegroundColor Cyan
$key = Read-TreinonSecretInput "Chave Brevo"
if ($key -notmatch '^xkeysib-[A-Za-z0-9-]{20,}$') { throw "Isso nao parece uma chave Brevo (xkeysib-...)." }

# Test the key before saving it
try {
  $acc = Invoke-RestMethod -Uri "https://api.brevo.com/v3/account" -Headers @{ "api-key" = $key; Accept = "application/json" }
  Write-Host "OK: conta Brevo $($acc.email)" -ForegroundColor Green
} catch {
  Write-Host "`nO Brevo recusou o pedido: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Causa mais comum: o Brevo bloqueia enderecos IP nao autorizados." -ForegroundColor Yellow
  Write-Host "No Brevo: Settings -> Seguranca -> IPs autorizados -> desligar o bloqueio" -ForegroundColor Yellow
  Write-Host "(o servidor da app nao tem IP fixo, por isso o bloqueio tem de ficar desligado)." -ForegroundColor Yellow
  Write-Host "Depois volte a correr este script. Se continuar, crie uma chave nova e copie-a inteira." -ForegroundColor Yellow
  exit 1
}

$body = @(
  @{ name = "BREVO_API_KEY"; value = $key },
  @{ name = "EMAIL_FROM"; value = $From }
) | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$ProjectRef/secrets" `
  -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body | Out-Null

Write-Host "Feito: os convites com email passam a ser enviados por $From." -ForegroundColor Green
Write-Host "Teste: Treinadores -> Convidar, com o seu proprio email." -ForegroundColor Green
