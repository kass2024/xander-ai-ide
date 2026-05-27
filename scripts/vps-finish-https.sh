#!/bin/sh
# Run on VPS after certbot succeeded but nginx crashed (missing ssl options files).
set -e
cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-.env.production}"

git fetch origin main
git reset --hard origin/main

if [ ! -f "certbot/conf/live/xanderai.online/fullchain.pem" ]; then
  echo "ERROR: No cert at certbot/conf/live/xanderai.online/ — run ./scripts/setup-ssl.sh first"
  exit 1
fi

grep -q '^NGINX_CONFIG=' "$ENV_FILE" 2>/dev/null && \
  sed -i 's|^NGINX_CONFIG=.*|NGINX_CONFIG=./nginx.ssl.conf|' "$ENV_FILE" || \
  echo 'NGINX_CONFIG=./nginx.ssl.conf' >> "$ENV_FILE"

systemctl stop nginx apache2 2>/dev/null || true

docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file "$ENV_FILE" up -d --force-recreate nginx

sleep 3
docker logs xander_nginx --tail 15
docker exec xander_nginx nginx -t

echo ""
echo "==> Test HTTPS:"
curl -sI https://xanderai.online | head -3
curl -s https://api.xanderai.online/health
echo ""

echo "==> Rebuild web (HTTPS API URL):"
echo "  docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file $ENV_FILE build --no-cache web"
echo "  docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file $ENV_FILE up -d"
