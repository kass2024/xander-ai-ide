@echo off
echo Starting Xander AI IDE Applications...
echo.

echo Starting Backend API...
cd apps\backend
start "Backend API" cmd /k "npm run dev"

echo.
echo Starting Web Portal...
cd ..\web
start "Web Portal" cmd /k "npm run dev"

echo.
echo Starting Desktop App...
cd ..\desktop
start "Desktop App" cmd /k "npm run dev"

echo.
echo All applications are starting!
echo.
echo Backend API: http://localhost:3001
echo Web Portal: http://localhost:3000
echo Desktop App: Electron window
echo.
pause
