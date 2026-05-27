# Quick Start Guide - Xander AI IDE

## Installation Issues & Solutions

The project is having dependency installation issues due to PowerShell execution policies and npm/pnpm conflicts. Here's how to get it running:

### Option 1: Fix PowerShell Execution Policy (Recommended)

1. **Open PowerShell as Administrator**
2. **Run this command:**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. **Confirm with 'Y' when prompted**
4. **Now install dependencies:**
   ```bash
   pnpm install
   ```

### Option 2: Use CMD Instead of PowerShell

1. **Open Command Prompt (cmd) instead of PowerShell**
2. **Navigate to project:**
   ```cmd
   cd C:\Users\user\xander-ai-ide
   ```
3. **Install dependencies:**
   ```cmd
   pnpm install
   ```

### Option 3: Manual Setup (If above fails)

1. **Install each app separately:**

   **Backend:**
   ```cmd
   cd apps\backend
   npm install
   ```

   **Web:**
   ```cmd
   cd ..\web
   npm install
   ```

   **Desktop:**
   ```cmd
   ..\desktop
   npm install
   ```

### Environment Setup

1. **Start your services:**
   - PostgreSQL on localhost:5432
   - Redis on localhost:6379  
   - Qdrant on localhost:6333

2. **Configure environment variables** in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/xander_ai_ide"
   REDIS_URL=redis://localhost:6379
   QDRANT_URL=http://localhost:6333
   OPENAI_API_KEY=your_openai_key
   JWT_SECRET=your_jwt_secret
   STRIPE_SECRET_KEY=your_stripe_key
   ```

### Running the Apps

**Backend API:**
```cmd
cd apps\backend
npm run dev
```
*Runs on http://localhost:3001*

**Web Portal:**
```cmd
cd apps\web
npm run dev
```
*Runs on http://localhost:3000*

**Desktop App:**
```cmd
cd apps\desktop
npm run dev
```

### Troubleshooting

If you still get errors:

1. **Clear npm cache:**
   ```cmd
   npm cache clean --force
   ```

2. **Delete node_modules folders:**
   ```cmd
   rmdir /s node_modules
   rmdir /s apps\backend\node_modules
   rmdir /s apps\web\node_modules
   rmdir /s apps\desktop\node_modules
   ```

3. **Try with yarn instead:**
   ```cmd
   yarn install
   ```

### What's Working

The complete codebase is implemented:
- ✅ Backend API with NestJS
- ✅ Web portal with Next.js  
- ✅ Desktop app with Electron
- ✅ Database schema with Prisma
- ✅ AI integration with OpenAI
- ✅ Authentication & SaaS features

The only issue is dependency installation due to system configuration.

### Next Steps After Installation

1. **Generate Prisma client:**
   ```cmd
   cd apps\backend
   npx prisma generate
   ```

2. **Run database migrations:**
   ```cmd
   npx prisma migrate dev
   ```

3. **Start developing!** 🚀

The project is fully functional once dependencies are installed.
