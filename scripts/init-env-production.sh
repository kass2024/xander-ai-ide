#!/bin/sh
# Create or patch .env.production with safe defaults for first VPS deploy.
set -e
cd "$(dirname "$0")/.."
ENV_FILE=".env.production"
EXAMPLE=".env.production.example"

if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE" "$ENV_FILE"
  echo "Created $ENV_FILE from $EXAMPLE"
fi

set_kv() {
  key="$1"
  value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

set_kv POSTGRES_PASSWORD "change_this_strong_password"
set_kv JWT_SECRET "change_this_jwt_secret"
set_kv POSTGRES_USER "postgres"
set_kv POSTGRES_DB "xander_ai_ide"
set_kv WEB_URL "https://xanderai.online"
set_kv NEXT_PUBLIC_API_URL "https://api.xanderai.online"
set_kv CERTBOT_EMAIL "admin@xanderai.online"

echo "==> $ENV_FILE (required keys):"
grep -E '^(POSTGRES_PASSWORD|JWT_SECRET|POSTGRES_USER|POSTGRES_DB)=' "$ENV_FILE"
