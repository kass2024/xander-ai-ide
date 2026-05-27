@echo off
echo Installing Xander AI IDE dependencies...
cd /d "%~dp0"

echo Installing npm packages...
call npm install

echo Installation complete!
echo.
echo To run the development server:
echo npm run dev
echo.
pause
