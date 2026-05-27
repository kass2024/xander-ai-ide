# HTTPS live — xanderai.online

VPS IP: **66.29.135.120**

## 1. DNS (registrar) — required before SSL

| Host | Type | Value |
|------|------|--------|
| `@` | A | `66.29.135.120` |
| `www` | A | `66.29.135.120` |
| `api` | A | `66.29.135.120` |

Verify (all three must return the VPS IP):

```bash
dig +short xanderai.online
dig +short www.xanderai.online
dig +short api.xanderai.online
```

Certbot failed on the old domain because **www** and **api** had no DNS (NXDOMAIN). All three records are required for `xanderai.online`.

## 2. One-command redeploy (VPS)

```bash
cd /opt/xander-ai-ide
git checkout -- scripts/setup-ssl-parrotmoc.sh scripts/init-env-production.sh 2>/dev/null || true
git pull origin main
chmod +x scripts/redeploy-xanderai-vps.sh
export VPS_IP=66.29.135.120
export CERTBOT_EMAIL=admin@xanderai.online
./scripts/redeploy-xanderai-vps.sh
```

## 3. Manual steps

```bash
cd /opt/xander-ai-ide
git pull origin main
./scripts/init-env-production.sh

sudo systemctl stop nginx apache2 2>/dev/null

docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache web backend
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

curl -s http://api.xanderai.online/health
curl -s http://xanderai.online/api-health

chmod +x scripts/setup-ssl.sh
CERTBOT_EMAIL=admin@xanderai.online ./scripts/setup-ssl.sh

docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file .env.production build --no-cache web
docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file .env.production up -d
```

## 4. Verify HTTPS

```bash
curl -sI https://xanderai.online | head -3
curl -s https://api.xanderai.online/health
docker compose -f docker-compose.prod.yml ps
```

| URL | Service |
|-----|---------|
| https://xanderai.online | Web |
| https://api.xanderai.online | API |
| Postgres | Internal Docker only |

## Old domain (parrotmoc.online)

Do not use for this stack. Stop host Apache/nginx if still installed:

```bash
sudo systemctl stop apache2 nginx 2>/dev/null
sudo systemctl disable apache2 nginx 2>/dev/null
```
