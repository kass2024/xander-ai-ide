#!/bin/sh
# Diagnose why api.xanderai.online returns nothing
set -e
cd "$(dirname "$0")/.."

echo "=== DNS ==="
dig +short xanderai.online A 2>/dev/null || true
dig +short api.xanderai.online A 2>/dev/null || true
echo "(api must return your VPS IP, e.g. 66.29.135.120)"

echo ""
echo "=== Backend inside Docker ==="
docker exec xander_backend wget -qO- http://127.0.0.1:3001/health/live 2>/dev/null || echo "FAIL: backend container"
docker exec xander_nginx wget -qO- http://backend:3001/health 2>/dev/null || echo "FAIL: nginx -> backend"

echo ""
echo "=== Nginx routing (no DNS needed) ==="
curl -sv -H "Host: api.xanderai.online" http://127.0.0.1/health 2>&1 | tail -15
curl -s http://127.0.0.1/api-health 2>/dev/null || true
echo ""

echo ""
echo "=== Public URLs ==="
curl -sv --connect-timeout 5 http://api.xanderai.online/health 2>&1 | tail -20 || echo "FAIL/TIMEOUT: fix DNS — add A record: api -> VPS IP"
curl -s --connect-timeout 5 http://xanderai.online/api-health 2>/dev/null || true
echo ""
