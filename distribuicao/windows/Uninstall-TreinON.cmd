@echo off
setlocal enableextensions
title TreinON - Desinstalar (Windows)
set "STARTMENU=%AppData%\Microsoft\Windows\Start Menu\Programs\TreinON"
set "DESKTOP=%UserProfile%\Desktop"
del /q "%STARTMENU%\TreinON.lnk" >nul 2>&1
del /q "%DESKTOP%\TreinON.lnk" >nul 2>&1
del /q "%STARTMENU%\Uninstall-TreinON.cmd" >nul 2>&1
rmdir "%STARTMENU%" >nul 2>&1
echo [TreinON] Removido. Pode fechar esta janela.
pause
