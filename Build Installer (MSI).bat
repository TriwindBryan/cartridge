@echo off
title Build Fulton installer
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js first: winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)

echo  Building the Fulton installer. The first time, this downloads Electron and the WiX MSI tools (a few minutes).
echo.
call npm install --no-audit --no-fund || goto :fail
call npm test || goto :fail
call npm run dist:msi || goto :fail

echo.
echo  Done. Your installer is in the dist folder:
dir /b dist\*.msi
explorer dist
pause
exit /b 0

:fail
echo.
echo  The build failed. Scroll up for the error.
pause
exit /b 1
