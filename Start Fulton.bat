@echo off
title Fulton
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Fulton needs Node.js to run from source.
  echo.
  echo  Install it once, then double-click this file again:
  echo    winget install OpenJS.NodeJS.LTS
  echo  or download the LTS installer from https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo First run: downloading Electron. This takes a minute...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

start "" /b cmd /c "npx electron ."
exit /b 0
