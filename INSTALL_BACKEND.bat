@echo off
echo 🔧 Installing Xander AI IDE Backend...

echo.
echo 📦 Installing dependencies...
cd apps/backend
call npm install

echo.
echo 🗄️ Setting up database...
call npm run prisma:migrate
call npm run prisma:generate

echo.
echo 🚀 Starting backend server...
call npm run dev

pause
