# HTTPS live — parrotmoc.online

VPS IP: **66.29.135.120**

## 1. DNS (registrar)

| Host | Type | Value |
|------|------|--------|
| `@` | A | `66.29.135.120` |
| `www` | A | `66.29.135.120` |
| `api` | A | `66.29.135.120` |

Check: `dig +short parrotmoc.online` → `66.29.135.120`

## 2. Pull + fix nginx (port 443 restart loop)

```bash
cd /opt/xander-ai-ide
chmod +x scripts/vps-update.sh
./scripts/vps-update.sh
# Or manually: git checkout -- scripts/init-env-production.sh && git pull origin main

# Stop host nginx/apache using ports 80/443
sudo systemctl stop nginx apache2 2>/dev/null

docker compose -f docker-compose.prod.yml --env-file .env.production up -d nginx
docker logs xander_nginx --tail 10
```

Nginx should stay **running** (only port 80 until SSL).

## 3. Obtain SSL + enable HTTPS

```bash
chmod +x scripts/setup-ssl-parrotmoc.sh
export CERTBOT_EMAIL=admin@parrotmoc.online
./scripts/setup-ssl-parrotmoc.sh
```

## 4. HTTPS URLs in env + rebuild web

```bash
grep -E '^(WEB_URL|NEXT_PUBLIC_API_URL)=' .env.production
# Should be https://parrotmoc.online and https://api.parrotmoc.online

docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache web
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## 5. Verify

```bash
curl -sI https://parrotmoc.online | head -3
curl -s https://api.parrotmoc.online/health
docker compose -f docker-compose.prod.yml ps
```

| URL | Service |
|-----|---------|
| https://parrotmoc.online | Web |
| https://api.parrotmoc.online | API + DB via backend |

Database (Postgres) is internal only — not exposed on the internet.

## Cloudflare (optional)

If using Cloudflare proxy: SSL/TLS mode **Full (strict)** after step 3.
