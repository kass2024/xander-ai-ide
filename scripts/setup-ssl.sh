#!/bin/sh
# Obtain Let's Encrypt certs and enable HTTPS for xanderai.online
set -e

cd "$(dirname "$0")/.."

DOMAIN="${DOMAIN:-xanderai.online}"
API_DOMAIN="${API_DOMAIN:-api.xanderai.online}"
EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"
ENV_FILE="${ENV_FILE:-.env.production}"
VPS_IP="${VPS_IP:-}"

echo "==> Domain: $DOMAIN / $API_DOMAIN"
echo "==> Certbot email: $EMAIL"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not installed"
  exit 1
fi

echo "==> DNS check (all must resolve to this VPS)..."
for host in "$DOMAIN" "www.$DOMAIN" "$API_DOMAIN"; do
  ip=$(dig +short "$host" A 2>/dev/null | head -1)
  if [ -z "$ip" ]; then
    echo "ERROR: No A record for $host — add it at your registrar before SSL."
    exit 1
  fi
  echo "    $host -> $ip"
  if [ -n "$VPS_IP" ] && [ "$ip" != "$VPS_IP" ]; then
    echo "WARN: $host points to $ip (expected $VPS_IP)"
  fi
done

echo "==> Stopping host nginx/apache (free ports 80/443)..."
systemctl stop nginx apache2 2>/dev/null || true
systemctl disable nginx apache2 2>/dev/null || true

mkdir -p certbot/www certbot/conf

COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

# Bootstrap HTTP nginx (no SSL config yet)
if grep -q '^NGINX_CONFIG=' "$ENV_FILE" 2>/dev/null; then
  sed -i 's|^NGINX_CONFIG=.*|NGINX_CONFIG=./nginx.prod.conf|' "$ENV_FILE"
else
  echo 'NGINX_CONFIG=./nginx.prod.conf' >> "$ENV_FILE"
fi

echo "==> Starting stack (HTTP on port 80)..."
$COMPOSE up -d postgres redis qdrant backend web nginx

sleep 3
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
    echo "ERROR: certbot failed. Ensure A records exist for:"
    echo "  $DOMAIN  www.$DOMAIN  $API_DOMAIN"
    exit 1
  }

if [ ! -f "certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
  echo "ERROR: certificate missing at certbot/conf/live/$DOMAIN/"
  exit 1
fi

echo "==> Enabling HTTPS..."
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

echo ""
echo "==> Rebuild web + backend for new domain URLs:"
echo "  docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file $ENV_FILE build --no-cache web backend"
echo "  docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file $ENV_FILE up -d"
echo ""
echo "==> Test:"
echo "  curl -sI https://$DOMAIN | head -3"
echo "  curl -s https://$API_DOMAIN/health"
