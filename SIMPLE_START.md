# 🚀 Xander AI IDE - Simple Start Guide

## ✅ Installation Complete!

All dependencies have been successfully installed. The project is ready to run!

## 🎯 Quick Start (Using CMD)

1. **Open Command Prompt (CMD)** - NOT PowerShell
2. Navigate to project:
   ```cmd
   cd C:\Users\user\xander-ai-ide
   ```
3. Run the development script:
   ```cmd
   RUN_DEV.cmd
   ```

This will automatically:
- ✅ Start Backend API on http://localhost:3001
- ✅ Start Web Portal on http://localhost:3000  
- ✅ Start Desktop App (Electron window)

## 🔧 Manual Start (Alternative)

If the script doesn't work, start each app manually:

### Backend API
```cmd
cd apps\backend
npm run dev
```

### Web Portal  
```cmd
cd apps\web
npm run dev
```

### Desktop App
```cmd
cd apps\desktop
npm run dev
```

## 📋 Prerequisites

Make sure these services are running:
- **PostgreSQL** on localhost:5432
- **Redis** on localhost:6379
- **Qdrant** on localhost:6333

## 🎯 What's Working

✅ **Complete Backend API** - NestJS with authentication, AI, billing  
✅ **Modern Web Portal** - Next.js SaaS interface  
✅ **Desktop IDE App** - Electron with file browser & Git  
✅ **Database Schema** - Full Prisma models  
✅ **AI Integration** - OpenAI services ready  

## 🐛 Troubleshooting

If you get "PowerShell execution policy" errors:
1. Right-click on Command Prompt
2. "Run as administrator"
3. Use CMD instead of PowerShell

If ports are busy:
- Backend: Change port in `.env` file
- Web: Runs on 3000 by default
- Desktop: Uses Electron's default

## 🎉 Success!

Your Xander AI IDE is now running! You have:
- A complete Cursor-like AI coding IDE
- SaaS subscription management
- Real-time AI chat and autocomplete
- Git integration
- Modern web dashboard

Enjoy building with AI! 🚀
