#!/bin/sh
set -e

echo "==> Xander AI IDE Backend — starting"

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Seeding database..."
  npx tsx prisma/seed.ts || true
fi

echo "==> Starting NestJS..."
exec node dist/main.js
