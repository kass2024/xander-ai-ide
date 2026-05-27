#!/bin/sh
set -e

echo "==> Xander AI IDE Backend — starting"
echo "==> NODE_ENV=${NODE_ENV:-unset} PORT=${PORT:-3001}"

if [ -z "$JWT_SECRET" ]; then
  echo "ERROR: JWT_SECRET is not set. Add it to .env.production (openssl rand -base64 48)"
  exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "ERROR: POSTGRES_PASSWORD is not set in .env.production"
  exit 1
fi

export DATABASE_URL="$(node /app/build-database-url.cjs)"
echo "==> DATABASE_URL -> postgres:${POSTGRES_DB:-xander_ai_ide} (credentials from POSTGRES_*)"

echo "==> Waiting for PostgreSQL..."
i=0
while [ "$i" -lt 15 ]; do
  if npx prisma migrate status >/dev/null 2>&1; then
    echo "==> PostgreSQL is reachable"
    break
  fi
  i=$((i + 1))
  if [ "$i" -eq 15 ]; then
    echo "ERROR: Cannot reach PostgreSQL after 15 attempts."
    echo "       If you changed POSTGRES_PASSWORD after first deploy, reset the DB volume or match the original password."
    exit 1
  fi
  echo "==> Retry $i/15..."
  sleep 2
done

echo "==> Running Prisma migrations..."
if ! npx prisma migrate deploy; then
  echo "ERROR: prisma migrate deploy failed."
  echo "       Run: docker logs xander_postgres --tail 20"
  exit 1
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Seeding database..."
  npx tsx prisma/seed.ts || echo "WARN: seed skipped or failed (non-fatal)"
fi

echo "==> Starting NestJS..."
exec node dist/main.js
