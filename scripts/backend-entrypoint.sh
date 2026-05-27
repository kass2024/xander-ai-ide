#!/bin/sh
set -e

echo "==> Xander AI IDE Backend — starting"
echo "==> NODE_ENV=${NODE_ENV:-unset} PORT=${PORT:-3001}"

: "${POSTGRES_PASSWORD:=change_this_strong_password}"
: "${JWT_SECRET:=change_this_jwt_secret}"
export POSTGRES_PASSWORD JWT_SECRET

if [ "$POSTGRES_PASSWORD" = "change_this_strong_password" ] || [ "$JWT_SECRET" = "change_this_jwt_secret" ]; then
  echo "WARN: Using default POSTGRES_PASSWORD / JWT_SECRET — change these in .env.production before going live"
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
