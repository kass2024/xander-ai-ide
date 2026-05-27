#!/bin/sh
# Pull latest on VPS (discard local edits to tracked scripts) and restart nginx.
set -e
cd "$(dirname "$0")/.."

echo "==> Resetting local edits to repo scripts..."
git checkout -- scripts/init-env-production.sh scripts/setup-ssl-parrotmoc.sh scripts/setup-ssl.sh 2>/dev/null || true

echo "==> git pull..."
git pull origin main

echo "==> Stopping host nginx/apache..."
systemctl stop nginx apache2 2>/dev/null || true

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

# Use SSL overlay if certs exist
if [ -f "certbot/conf/live/xanderai.online/fullchain.pem" ]; then
  COMPOSE="$COMPOSE -f docker-compose.ssl.yml"
fi

$COMPOSE up -d --force-recreate nginx

sleep 2
docker compose -f docker-compose.prod.yml ps nginx 2>/dev/null || docker ps --filter name=xander_nginx
docker logs xander_nginx --tail 10
