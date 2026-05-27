@echo off
echo ========================================
echo    Xander AI IDE - Development Setup
echo ========================================
echo.

echo Checking if dependencies are installed...
if not exist apps\backend\node_modules (
    echo Dependencies not found. Running installation...
    call FIX_INSTALL.cmd
    echo.
)

echo.
echo Starting development servers...
echo.

echo 1. Starting Backend API (port 3001)...
cd apps\backend
start "Backend API" cmd /c "npm run dev"

echo.
echo 2. Starting Web Portal (port 3000)...
cd ..\web
start "Web Portal" cmd /c "npm run dev"

echo.
echo 3. Starting Desktop App...
cd ..\desktop
start "Desktop App" cmd /c "npm run dev"

echo.
echo ========================================
echo    All applications started!
echo ========================================
echo.
echo Backend API:     http://localhost:3001
echo Web Portal:      http://localhost:3000
echo Desktop App:     Electron window
echo.
echo Make sure these services are running:
echo - PostgreSQL (localhost:5432)
echo - Redis (localhost:6379)
echo - Qdrant (localhost:6333)
echo.
echo Press any key to exit...
pause > nul
