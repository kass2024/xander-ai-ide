# Database Setup Guide

## Quick Setup (PostgreSQL)

### Option 1: Docker (Recommended)
```bash
# Run PostgreSQL in Docker
docker run --name xander-postgres \
  -e POSTGRES_DB=xander_ai_ide \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# Your DATABASE_URL will be:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/xander_ai_ide"
```

### Option 2: Local PostgreSQL
1. Install PostgreSQL on your system
2. Create a database: `createdb xander_ai_ide`
3. Update your .env file with the correct connection string

### Option 3: SQLite (Development Only)
Update your .env file:
```
DATABASE_URL="file:./dev.db"
```

## Run Database Migrations
```bash
cd apps/backend
npm run prisma:migrate
npm run prisma:generate
```

## Start the Backend
```bash
cd apps/backend
npm install
npm run dev
```

## Test Authentication
```bash
node test-db-connection.js
```
