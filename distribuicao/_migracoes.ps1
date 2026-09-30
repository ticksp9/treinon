# TreinON — aplicar migrações pela API da Supabase (só precisa do Access Token;
# não usa a palavra-passe da base de dados). Regista cada migração na mesma tabela
# que o 'supabase db push' usa, por isso os dois métodos são compatíveis.

function Invoke-SupabaseSql([string]$ProjectRef, [string]$Token, [string]$Sql) {
  $body = @{ query = $Sql } | ConvertTo-Json -Depth 3
  Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$ProjectRef/database/query" `
    -Headers @{ Authorization = "Bearer $Token" } -ContentType "application/json; charset=utf-8" `
    -Body ([Text.Encoding]::UTF8.GetBytes($body))
}

function Sync-TreinonMigrations([string]$ProjectRef, [string]$Token, [string]$MigrationsDir) {
  $rows = Invoke-SupabaseSql $ProjectRef $Token "select version from supabase_migrations.schema_migrations"
  $applied = @{}
  foreach ($r in @($rows)) { if ($r.version) { $applied[[string]$r.version] = $true } }

  $pending = Get-ChildItem $MigrationsDir -Filter *.sql | Sort-Object Name | Where-Object {
    -not $applied.ContainsKey(($_.BaseName -split '_', 2)[0])
  }
  if (-not $pending) { Write-Host "Base de dados já está atualizada ($($applied.Count) migrações)." -ForegroundColor Green; return }

  foreach ($f in $pending) {
    $parts = $f.BaseName -split '_', 2
    $version = $parts[0]
    $name = if ($parts.Count -gt 1) { $parts[1] } else { '' }
    Write-Host "  -> $($f.Name)"
    $sql = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
    $safeName = $name.Replace("'", "''")
    # One transaction: either the migration and its record both apply, or nothing does
    $wrapped = "begin;`n$sql`n;`ninsert into supabase_migrations.schema_migrations (version, name) values ('$version', '$safeName');`ncommit;"
    Invoke-SupabaseSql $ProjectRef $Token $wrapped | Out-Null
  }
  Write-Host "Migrações aplicadas: $(@($pending).Count)" -ForegroundColor Green
}
