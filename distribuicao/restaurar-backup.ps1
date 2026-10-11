# TreinON — repor uma cópia de segurança numa base de dados TreinON
#
# Uso (PowerShell, na pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File distribuicao\restaurar-backup.ps1 -ProjectRef abcdefghijklmnop -Ficheiro C:\caminho\treinon-backup-clube-2026-10-11.json
#
# A base de dados de destino tem de ter primeiro as tabelas da TreinON
# (distribuicao\configurar-supabase.ps1 num projeto novo). O que já existir no destino
# fica como está: só entra o que falta, nada é apagado. Pode correr duas vezes sem duplicar.
#
# O token pedido é o da conta Supabase DO DESTINO. Não fica guardado no PC.

param(
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [Parameter(Mandatory = $true)][string]$Ficheiro,
  [int]$LinhasPorPedido = 400
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_segredos.ps1")
. (Join-Path $PSScriptRoot "_migracoes.ps1")

if (-not (Test-Path $Ficheiro)) { throw "Ficheiro não encontrado: $Ficheiro" }
Write-Host "A ler $Ficheiro ..." -ForegroundColor Cyan
$texto = [IO.File]::ReadAllText((Resolve-Path $Ficheiro), [Text.Encoding]::UTF8)
$backup = $texto | ConvertFrom-Json
if ($backup.format -ne 'treinon-backup') { throw "Este ficheiro não é uma cópia de segurança da TreinON." }

$tabelas = @($backup.tables.PSObject.Properties)
$totalLinhas = ($tabelas | ForEach-Object { @($_.Value).Count } | Measure-Object -Sum).Sum
$quem = if ($backup.scope.kind -eq 'club') { "clube '$($backup.scope.name)'" } else { "treinador" }
Write-Host ("Cópia de {0}, feita em {1}: {2} tabelas, {3} registos, {4} contas." -f $quem, $backup.created_at, $tabelas.Count, $totalLinhas, @($backup.users).Count)

$token = Read-TreinonSecretInput "Cole o Access Token da conta Supabase do DESTINO (projeto $ProjectRef) e prima Enter:"
if (-not $token) { throw "Sem token." }

# o destino tem de estar pelo menos na versão em que a cópia foi feita
$destino = Invoke-SupabaseSql $ProjectRef $token "select count(*) as n, max(version) as ultima from supabase_migrations.schema_migrations"
$d = @($destino)[0]
Write-Host ("Destino: {0} migrações (última {1}). Cópia: {2} (última {3})." -f $d.n, $d.ultima, $backup.migrations, $backup.last_migration)
if ($backup.last_migration -and $d.ultima -and ([string]$d.ultima -lt [string]$backup.last_migration)) {
  throw "O destino está numa versão mais antiga do que a cópia. Atualize primeiro a base de dados de destino (distribuicao\configurar-supabase.ps1)."
}
$temFuncao = Invoke-SupabaseSql $ProjectRef $token "select count(*) as n from pg_proc where proname = 'import_backup_data'"
if (@($temFuncao)[0].n -eq 0) { throw "O destino não tem a função de reposição. Aplique as migrações da TreinON nesse projeto primeiro." }

function Send-Parte([object]$Parte) {
  # dollar-quoting with a tag that cannot appear in the data
  $json = $Parte | ConvertTo-Json -Depth 50 -Compress
  $tag = "bk" + [Guid]::NewGuid().ToString('N')
  # triggers off for this transaction only (the data must arrive exactly as it was)
  $r = Invoke-SupabaseSql $ProjectRef $token ("begin; set local session_replication_role = replica; select public.import_backup_data(`$$tag`$" + $json + "`$$tag`$::jsonb) as r; commit;")
  return @($r | Where-Object { $_.r })[0].r
}

$carregadas = 0; $ignoradas = @()
Write-Host "`n[1/2] Contas ($(@($backup.users).Count)) ..." -ForegroundColor Cyan
$r = Send-Parte @{ format = 'treinon-backup'; users = @($backup.users); tables = @{} }
Write-Host "  contas criadas: $($r.users_created) (as que já existiam ficaram como estavam)"
foreach ($p in $r.skipped.PSObject.Properties) { $ignoradas += "$($p.Name): $($p.Value)" }

Write-Host "[2/2] Dados ..." -ForegroundColor Cyan
foreach ($t in ($tabelas | Sort-Object Name)) {
  $linhas = @($t.Value)
  $feitas = 0
  for ($i = 0; $i -lt $linhas.Count; $i += $LinhasPorPedido) {
    $bloco = @($linhas[$i..([Math]::Min($i + $LinhasPorPedido, $linhas.Count) - 1)])
    $r = Send-Parte @{ format = 'treinon-backup'; users = @(); tables = @{ $t.Name = $bloco } }
    foreach ($p in $r.loaded.PSObject.Properties) { $feitas += [int]$p.Value }
    foreach ($p in $r.skipped.PSObject.Properties) { $ignoradas += "$($p.Name): $($p.Value)" }
  }
  $carregadas += $feitas
  Write-Host ("  {0,-42} {1,6} de {2}" -f $t.Name, $feitas, $linhas.Count)
}

Write-Host "`nReposição concluída: $carregadas registos novos carregados." -ForegroundColor Green
Write-Host "(Registos que já existiam no destino não contam como novos.)"
if ($ignoradas.Count) {
  Write-Host "`nAtenção — não foi possível carregar:" -ForegroundColor Yellow
  $ignoradas | Select-Object -Unique | ForEach-Object { Write-Host "  $_" }
}
Write-Host "`nFalta: cada pessoa definir a palavra-passe no novo sítio ('Esqueci-me da palavra-passe' no ecrã de entrada)," -ForegroundColor Cyan
Write-Host "e ligar a aplicação a esta base de dados (ver docs\BACKUP-E-MIGRACAO.md)."
