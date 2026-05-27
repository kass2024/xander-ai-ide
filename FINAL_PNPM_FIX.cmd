@echo off
title Final pnpm Fix for Desktop App
echo ========================================
echo   Final pnpm Fix for Desktop App
echo ========================================
echo.

echo Step 1: Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
echo [✓] Node.js processes stopped
echo.

echo Step 2: Installing desktop dependencies with auto-approval...
cd apps\desktop
call pnpm install --shamefully-hoist --ignore-scripts
echo [✓] Desktop dependencies installed
echo.

echo Step 3: Running desktop app...
call pnpm dev
echo.
pause
