# TreinON — tokens guardados neste PC, cifrados com o Windows (DPAPI).
# Só a mesma conta de utilizador, neste mesmo PC, os consegue ler.
# Ficam em %APPDATA%\TreinON\*.cred  (apagar: -EsquecerTokens nos scripts)

$script:TreinonSecretsDir = Join-Path $env:APPDATA "TreinON"

function Get-TreinonSecret([string]$Name) {
  $f = Join-Path $script:TreinonSecretsDir "$Name.cred"
  if (-not (Test-Path $f)) { return $null }
  try {
    $sec = (Get-Content $f -Raw).Trim() | ConvertTo-SecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  } catch { return $null }
}

function Set-TreinonSecret([string]$Name, [string]$Value) {
  New-Item -ItemType Directory -Force $script:TreinonSecretsDir | Out-Null
  $f = Join-Path $script:TreinonSecretsDir "$Name.cred"
  ConvertTo-SecureString $Value -AsPlainText -Force | ConvertFrom-SecureString | Set-Content $f -Encoding ascii
}

function Remove-TreinonSecret([string]$Name) {
  $f = Join-Path $script:TreinonSecretsDir "$Name.cred"
  if (Test-Path $f) { Remove-Item $f -Force }
}

function Read-TreinonSecretInput([string]$Prompt) {
  Write-Host $Prompt
  $sec = Read-Host -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

<#
  Returns a token: from the encrypted store, or asks once and stores it.
  $Validate: scriptblock returning $true for a well-formed token.
#>
function Get-TreinonToken([string]$Name, [string]$Prompt, [scriptblock]$Validate) {
  $t = Get-TreinonSecret $Name
  if ($t -and (& $Validate $t)) {
    Write-Host "A usar o token '$Name' guardado neste PC." -ForegroundColor DarkGray
    return $t
  }
  for ($i = 1; $i -le 3; $i++) {
    $t = Read-TreinonSecretInput $Prompt
    if (& $Validate $t) {
      Set-TreinonSecret $Name $t
      Write-Host "Token guardado (cifrado) — não será pedido nas próximas vezes." -ForegroundColor DarkGray
      return $t
    }
    Write-Host "Esse valor não parece o token certo. Tente de novo." -ForegroundColor Yellow
  }
  throw "Token '$Name' inválido 3 vezes."
}
