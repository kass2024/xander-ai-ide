#!/bin/sh
# Quick backend diagnostics on VPS
set -e
cd "$(dirname "$0")/.."

echo "=== Container status ==="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Backend logs (last 100 lines) ==="
docker logs xander_backend --tail 100 2>&1 || true

echo ""
echo "=== Backend health ==="
docker inspect xander_backend --format '{{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true

echo ""
echo "=== Postgres logs (last 20) ==="
docker logs xander_postgres --tail 20 2>&1 || true
