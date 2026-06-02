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

echo ""
echo "==> Waiting for backend (migrations + NestJS can take up to 2 min)..."
BACKEND_OK=0
for i in $(seq 1 60); do
  if docker exec xander_backend wget -qO- http://localhost:3001/health/live >/dev/null 2>&1; then
    BACKEND_OK=1
    echo "==> Backend live after ${i} attempt(s)"
    break
  fi
  sleep 3
done

if [ "$BACKEND_OK" -ne 1 ]; then
  echo "ERROR: Backend did not become healthy — check logs:" >&2
  docker logs xander_backend --tail 60
  exit 1
fi

if curl -sf -H "Host: api.xanderai.online" "http://127.0.0.1:${DOCKER_NGINX_PORT}/health" >/dev/null; then
  echo "==> API OK on 127.0.0.1:${DOCKER_NGINX_PORT}/health"
  curl -s -H "Host: api.xanderai.online" "http://127.0.0.1:${DOCKER_NGINX_PORT}/health/ai" | head -c 400
  echo ""
else
  echo "ERROR: nginx proxy health check failed — check:" >&2
  echo "  docker logs xander_nginx --tail 20"
  echo "  docker logs xander_backend --tail 40"
  exit 1
fi
