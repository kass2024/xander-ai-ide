@echo off
echo Fixing Xander AI IDE Installation...
echo.

:: Clean up any existing node_modules and package-lock files
echo Cleaning up existing files...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
if exist apps\backend\node_modules rmdir /s /q apps\backend\node_modules
if exist apps\backend\package-lock.json del apps\backend\package-lock.json
if exist apps\web\node_modules rmdir /s /q apps\web\node_modules
if exist apps\web\package-lock.json del apps\web\package-lock.json
if exist apps\desktop\node_modules rmdir /s /q apps\desktop\node_modules
if exist apps\desktop\package-lock.json del apps\desktop\package-lock.json

echo.
echo Installing backend dependencies...
cd apps\backend
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo Backend installation failed!
    pause
    exit /b 1
)

echo.
echo Installing web dependencies...
cd ..\web
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo Web installation failed!
    pause
    exit /b 1
)

echo.
echo Installing desktop dependencies...
cd ..\desktop
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo Desktop installation failed!
    pause
    exit /b 1
)

echo.
echo ✅ All dependencies installed successfully!
echo.
echo To start the applications:
echo   cd apps\backend && npm run dev     (Backend API)
echo   cd apps\web && npm run dev         (Web Portal)
echo   cd apps\desktop && npm run dev     (Desktop App)
echo.
echo Make sure PostgreSQL, Redis, and Qdrant are running!
echo.
pause
