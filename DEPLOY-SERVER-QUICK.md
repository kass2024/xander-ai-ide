# parrotmoc.online — Server deploy cheat sheet

**Repo:** https://github.com/kass2024/xander-ai-ide.git

## DNS (registrar)

| Host | Type | Value |
|------|------|--------|
| `@` | A | VPS IP |
| `www` | A | VPS IP |
| `api` | A | VPS IP |

## VPS one-time setup

```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
```

## Deploy / update

```bash
cd /opt
git clone https://github.com/kass2024/xander-ai-ide.git   # first time only
cd xander-ai-ide

cp .env.production.example .env.production
# Or apply defaults in one step:
chmod +x scripts/init-env-production.sh && ./scripts/init-env-production.sh
nano .env.production   # change defaults before production traffic

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Required `.env.production`

```env
POSTGRES_PASSWORD=change_this_strong_password
JWT_SECRET=change_this_jwt_secret

OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

WEB_URL=https://parrotmoc.online
NEXT_PUBLIC_API_URL=https://api.parrotmoc.online

ADMIN_EMAIL=admin@parrotmoc.online
ADMIN_PASSWORD=strong_admin_password
RUN_SEED=true
```

**Stripe webhook URL:** `https://api.parrotmoc.online/billing/webhook`

## Docker services (virtual hosts in `nginx.prod.conf`)

| Container | Port | Domain |
|-----------|------|--------|
| xander_nginx | 80, 443 | routes traffic |
| xander_web | 3000 | parrotmoc.online, www |
| xander_backend | 3001 | api.parrotmoc.online |
| xander_postgres | internal | DB |
| xander_redis | internal | cache |
| xander_qdrant | internal | vector search |

## HTTPS / SSL (go live)

See **`SSL-PARROTMOC.md`** or run:

```bash
chmod +x scripts/setup-ssl-parrotmoc.sh
CERTBOT_EMAIL=admin@parrotmoc.online ./scripts/setup-ssl-parrotmoc.sh
```

## Port 80 already in use (nginx fails to start)

Something on the VPS is already bound to port 80 (often system nginx or Apache):

```bash
sudo ss -tlnp | grep ':80 '
sudo systemctl stop nginx apache2 2>/dev/null
sudo systemctl disable nginx apache2 2>/dev/null
docker compose -f docker-compose.prod.yml --env-file .env.production up -d nginx
```

## Verify

```bash
curl http://api.parrotmoc.online/health
curl http://parrotmoc.online
docker compose -f docker-compose.prod.yml ps
docker logs xander_backend --tail 50
```

## Backend unhealthy

```bash
docker logs xander_backend --tail 80
```

Common causes:

| Log message | Fix |
|-------------|-----|
| `OPENAI_API_KEY is not configured` | Set `OPENAI_API_KEY` in `.env.production` (API starts without it after update; AI routes need the key) |
| `prisma migrate deploy failed` | `POSTGRES_PASSWORD` in `.env.production` must match the password in `DATABASE_URL`; use host `postgres`, not `localhost` |
| Password with `@` `#` `%` | URL-encode the password in `DATABASE_URL` or use alphanumeric-only passwords |
| Container exits before Nest | Check migrate logs above; ensure `JWT_SECRET` is set |
| `POSTGRES_PASSWORD` changed after first deploy | Postgres volume keeps old password — reset volume or revert password |
| `password authentication failed` | `POSTGRES_PASSWORD` in `.env.production` must match what postgres was created with |
| `bcrypt_lib.node` / `Cannot find module bcrypt` | Rebuild backend image after pull (`npm rebuild bcrypt` fix in Dockerfile) |
| `address already in use` on port 80 | Stop host nginx/Apache (see above) |

```bash
chmod +x scripts/vps-backend-logs.sh
./scripts/vps-backend-logs.sh
```

**Reset DB only if fresh start is OK (deletes all data):**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production down
docker volume rm xander-ai-ide_xander_postgres_data
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

After `git pull`, rebuild backend only:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache backend
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Update after git push

```bash
cd /opt/xander-ai-ide && git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## HTTPS

- **Easy:** Cloudflare proxy on `@`, `www`, `api` (SSL Full)
- **Or:** Certbot + mount `/etc/letsencrypt` into nginx container

Full guide: `DEPLOY-PARROTMOC.md`
