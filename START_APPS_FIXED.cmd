@echo off
title Xander AI IDE - Start Applications
echo ========================================
echo   Starting Xander AI IDE Applications
echo ========================================
echo.

echo Checking if dependencies are installed...
if not exist apps\backend\node_modules (
    echo Dependencies not found. Running installation...
    call PROFESSIONAL_INSTALL.cmd
    echo.
)

echo.
echo Starting Backend API (port 3001)...
cd apps\backend
start "Backend API" cmd /k "echo Backend API starting... && npm run dev && pause"

echo.
echo Starting Web Portal (port 3000)...
cd ..\web
start "Web Portal" cmd /k "echo Web Portal starting... && npm run dev && pause"

echo.
echo Starting Desktop App...
cd ..\desktop
start "Desktop App" cmd /k "echo Desktop App starting... && npm run dev && pause"

echo.
echo ========================================
echo   ✅ All Applications Starting!
echo ========================================
echo.
echo Access URLs:
echo • Backend API:     http://localhost:3001
echo • Web Portal:      http://localhost:3000
echo • Desktop App:     Electron window
echo.
echo Prerequisites:
echo • PostgreSQL (localhost:5432)
echo • Redis (localhost:6379)
echo • Qdrant (localhost:6333)
echo.
echo Press any key to exit this window...
pause > nul
