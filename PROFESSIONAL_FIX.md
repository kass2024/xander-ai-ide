# Professional Fix for Xander AI IDE Dependencies

## Issues Identified:
1. Passport version conflict (^0.8.0 doesn't exist, only 0.7.0)
2. ESLint version conflicts between packages
3. Mixed package managers causing conflicts
4. Ignored build scripts in pnpm

## Solution: Use npm consistently with legacy-peer-deps

## Step 1: Clean Everything
```cmd
rmdir /s /q node_modules
rmdir /s /q apps\backend\node_modules
rmdir /s /q apps\web\node_modules
rmdir /s /q apps\desktop\node_modules
del /s /q *.lock.json
del /s /q pnpm-lock.yaml
```

## Step 2: Use npm with --legacy-peer-deps
```cmd
cd apps\backend
npm install --legacy-peer-deps

cd ..\web
npm install --legacy-peer-deps

cd ..\desktop
npm install --legacy-peer-deps
```

## Step 3: Approve pnpm builds (if using pnpm)
```cmd
pnpm approve-builds
```

## Step 4: Start Development
```cmd
# Backend
cd apps\backend
npm run dev

# Web
cd ..\web
npm run dev

# Desktop
cd ..\desktop
npm run dev
```

## Why This Works:
- --legacy-peer-deps ignores peer dependency conflicts
- npm is more stable than pnpm for this project
- All packages will install with compatible versions

## Alternative: Use yarn (if npm still fails)
```cmd
yarn install
```
