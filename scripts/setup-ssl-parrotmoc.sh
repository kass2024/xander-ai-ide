#!/bin/sh
# Obtain Let's Encrypt certs and enable HTTPS for parrotmoc.online
set -e

cd "$(dirname "$0")/.."

DOMAIN="${DOMAIN:-parrotmoc.online}"
API_DOMAIN="${API_DOMAIN:-api.parrotmoc.online}"
EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"
ENV_FILE="${ENV_FILE:-.env.production}"

echo "==> Domain: $DOMAIN / $API_DOMAIN"
echo "==> Certbot email: $EMAIL"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not installed"
  exit 1
fi

# Free ports 80/443 on the host (common conflict with system nginx)
echo "==> Stopping host web servers that may block ports 80/443..."
systemctl stop nginx apache2 2>/dev/null || true
systemctl disable nginx apache2 2>/dev/null || true

mkdir -p certbot/www certbot/conf

COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

echo "==> Starting stack (HTTP bootstrap on port 80 only)..."
$COMPOSE up -d postgres redis qdrant backend web

# Nginx: HTTP only until certs exist (no 443 bind — avoids restart loop)
$COMPOSE up -d nginx

echo "==> Waiting for nginx..."
sleep 3
if ! docker ps --format '{{.Names}}' | grep -q '^xander_nginx$'; then
  echo "ERROR: xander_nginx not running. Logs:"
  docker logs xander_nginx --tail 30 2>&1 || true
  exit 1
fi

NGINX_STATUS=$(docker inspect xander_nginx --format '{{.State.Status}}' 2>/dev/null || echo missing)
if [ "$NGINX_STATUS" != "running" ]; then
  echo "ERROR: nginx status=$NGINX_STATUS"
  docker logs xander_nginx --tail 40 2>&1 || true
  exit 1
fi

echo "==> Requesting Let's Encrypt certificate..."
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot:latest certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" -d "www.$DOMAIN" -d "$API_DOMAIN" \
  --email "$EMAIL" \
  --agree-tos --no-eff-email \
  -n \
  || {
    echo "ERROR: certbot failed. Check DNS A records point to this server:"
    echo "  $DOMAIN  www.$DOMAIN  $API_DOMAIN"
    exit 1
  }

if [ ! -f "certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
  echo "ERROR: certificate files missing under certbot/conf/live/$DOMAIN/"
  exit 1
fi

echo "==> Enabling HTTPS (nginx.ssl.conf + port 443)..."
if grep -q '^NGINX_CONFIG=' "$ENV_FILE" 2>/dev/null; then
  sed -i 's|^NGINX_CONFIG=.*|NGINX_CONFIG=./nginx.ssl.conf|' "$ENV_FILE"
else
  echo 'NGINX_CONFIG=./nginx.ssl.conf' >> "$ENV_FILE"
fi
if grep -q '^WEB_URL=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^WEB_URL=.*|WEB_URL=https://$DOMAIN|" "$ENV_FILE"
else
  echo "WEB_URL=https://$DOMAIN" >> "$ENV_FILE"
fi
if grep -q '^NEXT_PUBLIC_API_URL=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://$API_DOMAIN|" "$ENV_FILE"
else
  echo "NEXT_PUBLIC_API_URL=https://$API_DOMAIN" >> "$ENV_FILE"
fi

docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file "$ENV_FILE" up -d --force-recreate nginx

docker exec xander_nginx nginx -t
docker exec xander_nginx nginx -s reload 2>/dev/null || true

echo ""
echo "==> Update .env.production URLs to HTTPS (if not already):"
grep -q '^WEB_URL=https' "$ENV_FILE" 2>/dev/null || echo "WEB_URL=https://$DOMAIN"
grep -q '^NEXT_PUBLIC_API_URL=https' "$ENV_FILE" 2>/dev/null || echo "NEXT_PUBLIC_API_URL=https://$API_DOMAIN"

echo ""
echo "==> Rebuild web so the browser calls the HTTPS API:"
echo "  docker compose -f docker-compose.prod.yml --env-file $ENV_FILE build --no-cache web"
echo "  docker compose -f docker-compose.prod.yml --env-file $ENV_FILE up -d web"

echo ""
echo "==> Done. Test:"
echo "  curl -sI https://$DOMAIN | head -5"
echo "  curl -s https://$API_DOMAIN/health"
