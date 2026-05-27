@echo off
echo Installing Xander AI IDE dependencies...

:: Try using npm instead of pnpm to avoid PowerShell policy issues
echo Installing root dependencies...
call npm install

echo.
echo Installing backend dependencies...
cd apps\backend
call npm install
cd ..\..

echo.
echo Installing web dependencies...
cd apps\web
call npm install
cd ..\..

echo.
echo Installing desktop dependencies...
cd apps\desktop
call npm install
cd ..\..

echo.
echo Installation completed!
echo.
echo To start development:
echo   npm run dev:backend  (for backend API)
echo   npm run dev:web      (for web portal)  
echo   npm run dev:desktop  (for desktop app)
echo.
pause
