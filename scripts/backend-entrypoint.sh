#!/bin/sh
set -e

echo "==> Xander AI IDE Backend — starting"
echo "==> NODE_ENV=${NODE_ENV:-unset} PORT=${PORT:-3001}"

echo "==> Running Prisma migrations..."
if ! npx prisma migrate deploy; then
  echo "ERROR: prisma migrate deploy failed. Check DATABASE_URL and postgres logs."
  exit 1
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Seeding database..."
  npx tsx prisma/seed.ts || echo "WARN: seed skipped or failed (non-fatal)"
fi

echo "==> Starting NestJS..."
exec node dist/main.js
