#!/usr/bin/env bash
# Safe VPS update — Docker on 127.0.0.1:8088 only; never touches Apache ports 80/443.
#
#   cd /opt/xander-ai-ide && sudo bash scripts/vps-up.sh
#
set -euo pipefail

ROOT="${XANDER_ROOT:-/opt/xander-ai-ide}"
cd "$ROOT"

git pull origin main

docker rm -f xander_nginx 2>/dev/null || true

export NGINX_CONFIG="${NGINX_CONFIG:-./nginx.apache-proxy.conf}"
export DOCKER_NGINX_PORT="${DOCKER_NGINX_PORT:-8088}"

COMPOSE=(docker compose -f docker-compose.prod.yml)
[ -f .env.production ] && COMPOSE+=(--env-file .env.production)

"${COMPOSE[@]}" up -d --build

echo ""
echo "==> xander_nginx must show 127.0.0.1:${DOCKER_NGINX_PORT}->80 (NOT 0.0.0.0:80):"
docker ps --filter name=xander_nginx --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

PORTS=$(docker ps --filter name=xander_nginx --format '{{.Ports}}')
if echo "$PORTS" | grep -qE '0\.0\.0\.0:80|0\.0\.0\.0:443'; then
  echo "ERROR: Docker still bound to public 80/443 — aborting." >&2
  exit 1
fi

curl -sf -H "Host: api.xanderai.online" "http://127.0.0.1:${DOCKER_NGINX_PORT}/health" \
  && echo "==> API OK on 127.0.0.1:${DOCKER_NGINX_PORT}" \
  || echo "WARN: health check failed — docker logs xander_backend --tail 40"
