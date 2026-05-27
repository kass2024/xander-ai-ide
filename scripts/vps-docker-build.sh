#!/bin/sh
# Safe production build on VPS (fixes BuildKit cache / snapshot errors)
set -e
cd "$(dirname "$0")/.."

echo "==> Pruning broken Docker build cache..."
docker builder prune -af

echo "==> Building backend..."
docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache backend

echo "==> Building web..."
docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache web

echo "==> Starting all services..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "==> Status:"
docker compose -f docker-compose.prod.yml ps

echo "==> Backend health (wait ~30s if starting):"
sleep 5
curl -sf http://127.0.0.1:3001/health 2>/dev/null || docker logs xander_backend --tail 30

echo "Done."
