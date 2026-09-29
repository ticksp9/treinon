# Replays all migrations on a throwaway local PostgreSQL cluster (port 54329) and
# reports the first failing file. Nothing touches any real database.
#   powershell -ExecutionPolicy Bypass -File supabase\tests\replay-migrations.ps1
param([string]$PgBin = "C:\Program Files\PostgreSQL\18\bin", [int]$Port = 54329)

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$data = Join-Path $env:TEMP "treinon-pg-test"
$log = Join-Path $env:TEMP "treinon-pg-test.log"

if (Test-Path $data) {
  Start-Process -FilePath "$PgBin\pg_ctl.exe" -ArgumentList @("-D", "`"$data`"", "stop", "-m", "immediate") -NoNewWindow -Wait -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $data
}
& "$PgBin\initdb.exe" -D $data -U postgres -A trust -E UTF8 --locale=C | Out-Null
# Start detached: piping pg_ctl's output makes it hang on Windows (postmaster inherits the pipe)
Start-Process -FilePath "$PgBin\pg_ctl.exe" -ArgumentList @("-D", "`"$data`"", "-o", "`"-p $Port`"", "-l", "`"$log`"", "start") -WindowStyle Hidden
$ready = $false
for ($i = 0; $i -lt 60 -and -not $ready; $i++) {
  Start-Sleep -Milliseconds 500
  & "$PgBin\pg_isready.exe" -h localhost -p $Port -q
  $ready = ($LASTEXITCODE -eq 0)
}
if (-not $ready) { throw "PostgreSQL de teste nao arrancou (ver $log)" }
# psql writes NOTICEs to stderr; in Windows PowerShell that must not abort the run.
# Real failures are detected through psql's exit code (ON_ERROR_STOP).
$ErrorActionPreference = "Continue"
$env:PGOPTIONS = "-c client_min_messages=warning"

try {
  $psql = @("$PgBin\psql.exe", "-h", "localhost", "-p", "$Port", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-X")
  & $psql[0] $psql[1..($psql.Length-1)] -d postgres -c "CREATE DATABASE treinon_test" | Out-Null
  & $psql[0] $psql[1..($psql.Length-1)] -d treinon_test -f (Join-Path $PSScriptRoot "supabase-shim.sql") | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "shim failed" }

  $files = Get-ChildItem (Join-Path $root "supabase\migrations") -Filter *.sql | Sort-Object Name
  $n = 0
  foreach ($f in $files) {
    $out = & $psql[0] $psql[1..($psql.Length-1)] -d treinon_test -1 -f $f.FullName 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-Host "FALHOU: $($f.Name)" -ForegroundColor Red
      $out | Select-Object -Last 15 | ForEach-Object { Write-Host "  $_" }
      exit 1
    }
    $n++
  }
  Write-Host "OK: $n migracoes aplicadas sem erros" -ForegroundColor Green

  $env:PGOPTIONS = ""
  $out = & $psql[0] $psql[1..($psql.Length-1)] -d treinon_test -f (Join-Path $PSScriptRoot "security-smoke.sql") 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FALHOU: testes de seguranca" -ForegroundColor Red
    $out | Select-Object -Last 10 | ForEach-Object { Write-Host "  $_" }
    exit 1
  }
  Write-Host "OK: testes de seguranca" -ForegroundColor Green
}
finally {
  Start-Process -FilePath "$PgBin\pg_ctl.exe" -ArgumentList @("-D", "`"$data`"", "stop", "-m", "fast") -NoNewWindow -Wait
}
