@echo off
title Xander AI IDE - Professional Installation
echo ========================================
echo   Professional Installation for Xander AI IDE
echo ========================================
echo.

echo Step 1: Cleaning existing installations...
if exist node_modules rmdir /s /q node_modules >nul 2>&1
if exist apps\backend\node_modules rmdir /s /q apps\backend\node_modules >nul 2>&1
if exist apps\web\node_modules rmdir /s /q apps\web\node_modules >nul 2>&1
if exist apps\desktop\node_modules rmdir /s /q apps\desktop\node_modules >nul 2>&1
if exist package-lock.json del package-lock.json >nul 2>&1
if exist apps\backend\package-lock.json del apps\backend\package-lock.json >nul 2>&1
if exist apps\web\package-lock.json del apps\web\package-lock.json >nul 2>&1
if exist apps\desktop\package-lock.json del apps\desktop\package-lock.json >nul 2>&1
if exist pnpm-lock.yaml del pnpm-lock.yaml >nul 2>&1
echo [✓] Cleaned existing installations
echo.

echo Step 2: Installing Backend dependencies...
cd apps\backend
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo [❌] Backend installation failed!
    pause
    exit /b 1
)
echo [✓] Backend installed successfully
echo.

echo Step 3: Installing Web dependencies...
cd ..\web
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo [❌] Web installation failed!
    pause
    exit /b 1
)
echo [✓] Web installed successfully
echo.

echo Step 4: Installing Desktop dependencies...
cd ..\desktop
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo [❌] Desktop installation failed!
    pause
    exit /b 1
)
echo [✓] Desktop installed successfully
echo.

echo ========================================
echo   ✅ Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure PostgreSQL, Redis, and Qdrant are running
echo 2. Run: START_APPS.cmd to start all applications
echo.
echo Backend API:     http://localhost:3001
echo Web Portal:      http://localhost:3000
echo Desktop App:     Electron window
echo.
pause
