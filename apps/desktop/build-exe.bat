@echo off
echo Building Xander AI IDE...
cd /d "%~dp0"

echo Installing dependencies...
call npm install

echo Building application...
call npm run build

echo Packaging executable...
call npm run package

echo Build complete!
echo.
echo Your executable should be in the 'release' folder:
echo - Xander AI IDE Setup.exe
echo.
pause
