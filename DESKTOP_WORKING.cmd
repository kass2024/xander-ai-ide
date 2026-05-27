@echo off
title Desktop App Working Solution
echo ========================================
echo   Desktop App Working Solution
echo ========================================
echo.

echo Step 1: Go to desktop directory...
cd apps\desktop
echo Current directory: %CD%
echo.

echo Step 2: Install dependencies directly with npm...
call npm install --legacy-peer-deps
echo [✓] Dependencies installed with npm
echo.

echo Step 3: Run desktop app with npm...
echo Starting desktop app...
call npm run dev
echo.
pause
