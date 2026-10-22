@echo off
title Installing GQueues Workspace Manager Desktop App...
echo ========================================================
echo   GQueues Workspace Manager - Windows App Installer
echo ========================================================
echo.
echo Installing desktop shortcut for standalone app mode...

set APP_URL=https://ais-dev-enxnpelbddd7tflkv7rfjd-462514151820.asia-east1.run.app
set SHORTCUT_NAME=GQueues Workspace.url
set DESKTOP_PATH=%USERPROFILE%\Desktop\%SHORTCUT_NAME%
set STARTMENU_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\%SHORTCUT_NAME%

(
echo [InternetShortcut]
echo URL=%APP_URL%
echo IconIndex=0
echo IconFile=%SystemRoot%\System32\shell32.dll
echo HotKey=0
echo [{000214A0-0000-0000-C000-000000000046}]
echo Prop3=19,11
) > "%DESKTOP_PATH%"

copy "%DESKTOP_PATH%" "%STARTMENU_PATH%" >nul

echo [SUCCESS] GQueues Workspace has been installed to your Desktop and Start Menu!
echo.
echo Launching GQueues Workspace in standalone app mode...
start "" "%APP_URL%"
timeout /t 3 >nul
exit
