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
nano .env.production   # see required vars below

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Required `.env.production`

```env
POSTGRES_PASSWORD=strong_password
JWT_SECRET=openssl_rand_base64_48

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

## Verify

```bash
curl http://api.parrotmoc.online/health
curl http://parrotmoc.online
docker compose -f docker-compose.prod.yml ps
docker logs xander_backend --tail 30
```

## Update after git push

```bash
cd /opt/xander-ai-ide && git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## HTTPS

- **Easy:** Cloudflare proxy on `@`, `www`, `api` (SSL Full)
- **Or:** Certbot + mount `/etc/letsencrypt` into nginx container

Full guide: `DEPLOY-PARROTMOC.md`
