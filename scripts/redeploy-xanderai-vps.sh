#!/bin/sh
# Full redeploy on VPS after switching domain to xanderai.online
set -e
cd "$(dirname "$0")/.."

DOMAIN=xanderai.online
API_DOMAIN=api.xanderai.online
ENV_FILE=.env.production
VPS_IP="${VPS_IP:-66.29.135.120}"

echo "==> Xander AI IDE — redeploy for $DOMAIN"
echo "==> Expected VPS IP: $VPS_IP"

echo "==> Resetting local edits to tracked files..."
git checkout -- scripts/init-env-production.sh scripts/setup-ssl-parrotmoc.sh scripts/setup-ssl.sh 2>/dev/null || true
git pull origin main

chmod +x scripts/init-env-production.sh scripts/setup-ssl.sh scripts/vps-diagnose-api.sh scripts/vps-update.sh

./scripts/init-env-production.sh

# Remove old domain certs (parrotmoc / failed attempts)
echo "==> Clearing old TLS certificates..."
rm -rf certbot/conf/live certbot/conf/archive certbot/conf/renewal 2>/dev/null || true
mkdir -p certbot/www certbot/conf

systemctl stop nginx apache2 2>/dev/null || true
systemctl disable nginx apache2 2>/dev/null || true

export VPS_IP
export CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"

echo "==> DNS must be set BEFORE SSL:"
echo "    @   A  $VPS_IP"
echo "    www A  $VPS_IP"
echo "    api A  $VPS_IP"
dig +short "$DOMAIN" A || true
dig +short "$API_DOMAIN" A || true

echo "==> Rebuild images with new API URL..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build --no-cache backend web

echo "==> Start stack (HTTP)..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --force-recreate

echo "==> Verify HTTP..."
curl -sf -H "Host: $API_DOMAIN" http://127.0.0.1/health || echo "WARN: API via nginx failed"
curl -sf "http://$DOMAIN/api-health" 2>/dev/null || echo "WARN: api-health failed (DNS may not propagate yet)"

echo "==> SSL (requires DNS for @, www, api)..."
./scripts/setup-ssl.sh

echo "==> Final rebuild with HTTPS URLs..."
docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file "$ENV_FILE" build --no-cache web
docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file "$ENV_FILE" up -d

./scripts/vps-diagnose-api.sh

echo "==> Done. Open https://$DOMAIN"
