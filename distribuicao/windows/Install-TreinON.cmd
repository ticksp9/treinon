@echo off
setlocal enableextensions
title TreinON - Instalador (Windows)
REM Recomendado: abrir %APP_URL% no Edge/Chrome e usar "Instalar TreinON".
REM Este instalador cria apenas atalhos em modo aplicacao (alternativa).

REM --- Detectar Edge ou Chrome ---
set "BROWSER="
for %%E in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") do (
  if exist %%~E set "BROWSER=%%~E"
)
if "%BROWSER%"=="" (
  for %%C in ("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%ProgramFiles%\Google\Chrome\Application\chrome.exe") do (
    if exist %%~C set "BROWSER=%%~C"
  )
)
if "%BROWSER%"=="" (
  echo [TreinON] Nao encontrei Microsoft Edge nem Google Chrome.
  echo Por favor instale um deles e volte a executar este instalador.
  pause & exit /b 1
)

REM --- URL da app (altere aqui depois de publicar no Vercel) ---
set "APP_URL=https://treinon.vercel.app"
echo [TreinON] A instalar atalho para %APP_URL%

REM --- Destinos ---
set "STARTMENU=%AppData%\Microsoft\Windows\Start Menu\Programs\TreinON"
set "DESKTOP=%UserProfile%\Desktop"
if not exist "%STARTMENU%" mkdir "%STARTMENU%"

REM --- Script PS para criar atalhos ---
set "PS1=%TEMP%\treinon_shortcuts.ps1"
> "%PS1%" echo param([string]$Browser,[string]$AppUrl,[string]$StartMenu,[string]$Desktop)
>> "%PS1%" echo $shell = New-Object -ComObject WScript.Shell
>> "%PS1%" echo if (-not (Test-Path $StartMenu)) { New-Item -ItemType Directory -Path $StartMenu ^| Out-Null }
>> "%PS1%" echo $lnk1 = $shell.CreateShortcut((Join-Path $StartMenu 'TreinON.lnk'))
>> "%PS1%" echo $lnk1.TargetPath = $Browser
>> "%PS1%" echo $lnk1.Arguments  = "--new-window --app=`"$AppUrl`""
>> "%PS1%" echo $lnk1.Description = 'TreinON'
>> "%PS1%" echo $lnk1.Save()
>> "%PS1%" echo $lnk2 = $shell.CreateShortcut((Join-Path $Desktop 'TreinON.lnk'))
>> "%PS1%" echo $lnk2.TargetPath = $Browser
>> "%PS1%" echo $lnk2.Arguments  = "--new-window --app=`"$AppUrl`""
>> "%PS1%" echo $lnk2.Description = 'TreinON'
>> "%PS1%" echo $lnk2.Save()

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Browser "%BROWSER%" -AppUrl "%APP_URL%" -StartMenu "%STARTMENU%" -Desktop "%DESKTOP%"

REM --- Desinstalador ---
> "%STARTMENU%\Uninstall-TreinON.cmd" echo @echo off
>> "%STARTMENU%\Uninstall-TreinON.cmd" echo setlocal enableextensions
>> "%STARTMENU%\Uninstall-TreinON.cmd" echo set "STARTMENU=%%AppData%%\Microsoft\Windows\Start Menu\Programs\TreinON"
>> "%STARTMENU%\Uninstall-TreinON.cmd" echo set "DESKTOP=%%UserProfile%%\Desktop"
>> "%STARTMENU%\Uninstall-TreinON.cmd" echo del /q "%%STARTMENU%%\TreinON.lnk" ^>nul 2^>^&1
>> "%STARTMENU%\Uninstall-TreinON.cmd" echo del /q "%%DESKTOP%%\TreinON.lnk" ^>nul 2^>^&1
>> "%STARTMENU%\Uninstall-TreinON.cmd" echo del /q "%%STARTMENU%%\Uninstall-TreinON.cmd" ^>nul 2^>^&1
>> "%STARTMENU%\Uninstall-TreinON.cmd" echo rmdir "%%STARTMENU%%" ^>nul 2^>^&1
>> "%STARTMENU%\Uninstall-TreinON.cmd" echo echo [TreinON] Removido.
>> "%STARTMENU%\Uninstall-TreinON.cmd" echo pause

echo.
echo [TreinON] Instalacao concluida.
echo - Atalhos criados no Menu Iniciar e Ambiente de Trabalho.
echo - A app abrira em modo aplicacao (janela limpa).
echo.
echo Para remover: Menu Iniciar ^> TreinON ^> Uninstall-TreinON
pause
