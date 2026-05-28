#!/usr/bin/env bash
# Recover Xander Docker on 127.0.0.1:8088 + Apache proxy for xanderai.online ONLY
# Does NOT touch parrotcanada.site, parrotmoc.online, or other vhosts.
#
# Run on VPS:
#   cd /opt/xander-ai-ide && sudo bash scripts/vps-docker-8088-recover.sh
#
set -euo pipefail

ROOT="${XANDER_ROOT:-/opt/xander-ai-ide}"
PORT="${DOCKER_NGINX_PORT:-8088}"
DOMAIN="xanderai.online"
API="api.xanderai.online"
APACHE_SITE="/etc/apache2/sites-available/xanderai-online.conf"

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Run: sudo bash $0"
[ -d "$ROOT" ] || die "Missing $ROOT"
cd "$ROOT"

# --- 1. Ensure config files exist ---
for f in docker-compose.prod.yml docker-compose.apache-proxy.yml nginx.apache-proxy.conf apache/xanderai-online.conf; do
  [ -f "$f" ] || die "Missing $ROOT/$f — git pull or copy from repo"
done

# --- 2. Fix .env ---
ENV_FILE="$ROOT/.env.production"
if [ -f "$ENV_FILE" ]; then
  cp -a "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
  grep -q '^NGINX_CONFIG=' "$ENV_FILE" \
    && sed -i 's|^NGINX_CONFIG=.*|NGINX_CONFIG=./nginx.apache-proxy.conf|' "$ENV_FILE" \
    || echo 'NGINX_CONFIG=./nginx.apache-proxy.conf' >> "$ENV_FILE"
fi
export NGINX_CONFIG=./nginx.apache-proxy.conf

# --- 3. Remove broken nginx container (may still hold 80/443 bindings) ---
log "Removing old xander_nginx if present..."
docker stop xander_nginx 2>/dev/null || true
docker rm xander_nginx 2>/dev/null || true

# --- 4. Recreate full stack with internal port only ---
log "Starting Docker stack (nginx -> 127.0.0.1:${PORT})..."
COMPOSE=(docker compose -f docker-compose.prod.yml -f docker-compose.apache-proxy.yml)
[ -f .env.production ] && COMPOSE+=(--env-file .env.production)

"${COMPOSE[@]}" up -d --build

log "Waiting for backend..."
for i in $(seq 1 40); do
  if docker exec xander_backend wget -qO- http://localhost:3001/health/live >/dev/null 2>&1; then
    log "Backend healthy"
    break
  fi
  [ "$i" -eq 40 ] && warn_backend=1
  sleep 3
done
[ "${warn_backend:-0}" = 1 ] && echo "WARN: backend slow — check: docker logs xander_backend --tail 40"

# --- 5. Verify Docker nginx port ---
NGINX_PORTS=$(docker ps --filter name=xander_nginx --format '{{.Ports}}')
echo "xander_nginx ports: $NGINX_PORTS"
echo "$NGINX_PORTS" | grep -q "127.0.0.1:${PORT}" || die "Nginx not on 127.0.0.1:${PORT} — check docker-compose.apache-proxy.yml"
echo "$NGINX_PORTS" | grep -qE '0\.0\.0\.0:80|0\.0\.0\.0:443' && die "Nginx still on public 80/443 — aborting"

curl -sf -H "Host: $API" "http://127.0.0.1:${PORT}/health" && log "Docker API OK on :${PORT}" \
  || echo "WARN: curl http://127.0.0.1:${PORT}/health failed (backend may still be starting)"

# --- 6. Apache proxy vhost for Xander ONLY ---
log "Installing Apache vhost for $DOMAIN -> 127.0.0.1:${PORT}..."
a2enmod proxy proxy_http proxy_wstunnel headers ssl rewrite 2>/dev/null || true

[ -f "$APACHE_SITE" ] && cp -a "$APACHE_SITE" "${APACHE_SITE}.bak.$(date +%Y%m%d-%H%M%S)"
cp "$ROOT/apache/xanderai-online.conf" "$APACHE_SITE"

# SSL cert: prefer system certbot, else link from Docker certbot
if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  if [ -f "$ROOT/certbot/conf/live/${DOMAIN}/fullchain.pem" ]; then
    log "Linking Docker certbot certs for Apache..."
    mkdir -p "/etc/letsencrypt/live/${DOMAIN}"
    ln -sf "$ROOT/certbot/conf/live/${DOMAIN}/fullchain.pem" "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    ln -sf "$ROOT/certbot/conf/live/${DOMAIN}/privkey.pem" "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
  else
    echo "WARN: No SSL cert for $DOMAIN — run after this:"
    echo "  certbot certonly --webroot -w /var/www/html -d $DOMAIN -d www.$DOMAIN -d $API"
  fi
fi

a2ensite xanderai-online.conf 2>/dev/null || true
apachectl configtest
systemctl reload apache2 || systemctl restart apache2

# --- 7. Summary ---
echo ""
log "=== DONE ==="
echo "Docker:"
docker ps --filter name=xander --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo ""
echo "Apache vhosts (xanderai should appear):"
apachectl -S 2>&1 | grep -E 'xanderai|parrot|443|80' || apachectl -S 2>&1 | head -30
echo ""
echo "Test:"
echo "  curl -H 'Host: $API' http://127.0.0.1:${PORT}/health"
echo "  curl -Ik https://$DOMAIN"
echo ""
echo "If https://$DOMAIN still shows Parrot Canada, xander vhost is missing or wrong cert."
echo "Run: apachectl -S | grep xanderai"
