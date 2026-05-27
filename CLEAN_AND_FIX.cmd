@echo off
title Clean and Fix Package Manager Conflicts
echo ========================================
echo   Clean and Fix Package Manager Conflicts
echo ========================================
echo.

echo Step 1: Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
echo [✓] Node.js processes stopped
echo.

echo Step 2: Cleaning all node_modules and lock files...
if exist node_modules rmdir /s /q node_modules >nul 2>&1
if exist apps\backend\node_modules rmdir /s /q apps\backend\node_modules >nul 2>&1
if exist apps\web\node_modules rmdir /s /q apps\web\node_modules >nul 2>&1
if exist apps\desktop\node_modules rmdir /s /q apps\desktop\node_modules >nul 2>&1

if exist package-lock.json del package-lock.json >nul 2>&1
if exist apps\backend\package-lock.json del apps\backend\package-lock.json >nul 2>&1
if exist apps\web\package-lock.json del apps\web\package-lock.json >nul 2>&1
if exist apps\desktop\package-lock.json del apps\desktop\package-lock.json >nul 2>&1

if exist pnpm-lock.yaml del pnpm-lock.yaml >nul 2>&1
if exist apps\backend\pnpm-lock.yaml del apps\backend\pnpm-lock.yaml >nul 2>&1
if exist apps\web\pnpm-lock.yaml del apps\web\pnpm-lock.yaml >nul 2>&1
if exist apps\desktop\pnpm-lock.yaml del apps\desktop\pnpm-lock.yaml >nul 2>&1

echo [✓] All node_modules and lock files cleaned
echo.

echo Step 3: Installing dependencies with pnpm...
cd apps\backend
call pnpm install --shamefully-hoist
if errorlevel 1 (
    echo [❌] Backend installation failed!
    pause
    exit /b 1
)
echo [✓] Backend installed with pnpm

cd ..\web
call pnpm install --shamefully-hoist
if errorlevel 1 (
    echo [❌] Web installation failed!
    pause
    exit /b 1
)
echo [✓] Web installed with pnpm

cd ..\desktop
call pnpm install --shamefully-hoist
if errorlevel 1 (
    echo [❌] Desktop installation failed!
    pause
    exit /b 1
)
echo [✓] Desktop installed with pnpm

echo.
echo Step 4: Approving build scripts...
cd ..
call pnpm approve-builds
echo [✓] Build scripts approved
echo.

echo ========================================
echo   ✅ Installation Complete!
echo ========================================
echo.
echo Now you can run:
echo   cd apps\desktop
echo   pnpm dev
echo.
pause
