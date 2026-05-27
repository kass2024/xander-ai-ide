@echo off
title Production Build - Xander AI IDE
echo ========================================
echo   Production Build - Xander AI IDE
echo ========================================
echo.

echo Step 1: Building Backend API...
cd apps\backend
call npm run build
if errorlevel 1 (
    echo [❌] Backend build failed!
    pause
    exit /b 1
)
echo [✓] Backend built successfully
echo.

echo Step 2: Building Web Portal...
cd ..\web
call npm run build
if errorlevel 1 (
    echo [❌] Web build failed!
    pause
    exit /b 1
)
echo [✓] Web built successfully
echo.

echo Step 3: Building Desktop App...
cd ..\desktop
call npm run build
if errorlevel 1 (
    echo [❌] Desktop build failed!
    pause
    exit /b 1
)
echo [✓] Desktop built successfully
echo.

echo Step 4: Packaging Desktop App...
call npm run package
if errorlevel 1 (
    echo [❌] Desktop packaging failed!
    pause
    exit /b 1
)
echo [✓] Desktop app packaged successfully
echo.

echo ========================================
echo   ✅ Production Build Complete!
echo ========================================
echo.
echo Build outputs:
echo • Backend: apps\backend\dist\
echo • Web: apps\web\.next\
echo • Desktop: apps\desktop\release\
echo.
echo To run production:
echo • Backend: cd apps\backend && npm start
echo • Web: cd apps\web && npm start
echo • Desktop: Run installer from release folder
echo.
pause
