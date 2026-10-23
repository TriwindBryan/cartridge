@echo off
title Build Fulton
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js first: winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)

call npm install --no-audit --no-fund || goto :fail
call npm test || goto :fail
call npm run dist || goto :fail

echo.
echo  Done. Your launcher is in the dist folder:
dir /b dist\*.exe
explorer dist
pause
exit /b 0

:fail
echo.
echo  The build failed. Scroll up for the error.
pause
exit /b 1
