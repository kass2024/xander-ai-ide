# Full VPS production setup — parrotmoc.online

Same stack as your **local machine**, but everything runs inside Docker on the server.

| Local (your PC) | Production (VPS) |
|-----------------|------------------|
| `docker compose up` → postgres, redis, qdrant | Same 3 services in `docker-compose.prod.yml` |
| `cd apps/backend && npm run dev` | `xander_backend` container (NestJS) |
| `cd apps/web && npm run dev` | `xander_web` container (Next.js) |
| `DATABASE_URL=...@localhost:5432` | `DATABASE_URL=...@postgres:5432` (Docker network) |
| `npx prisma migrate deploy` + `seed` | **Automatic** on backend container start |
| Desktop `.exe` | Still on Windows; calls `https://api.parrotmoc.online` |

**Repo:** `https://github.com/kass2024/xander-ai-ide.git`

---

## Part 1 — Before you start

### What you need

- Linux VPS (Ubuntu 22.04/24.04), **2 GB RAM minimum**, **4 GB recommended** for first build
- SSH access (`root` or `sudo` user)
- Domain **parrotmoc.online** pointed to VPS IP
- Values from your local `apps/backend/.env` (OpenAI, Stripe, JWT, etc.)

### DNS records (at domain registrar)

| Host | Type | Value |
|------|------|--------|
| `@` | A | `YOUR_VPS_IP` |
| `www` | A | `YOUR_VPS_IP` |
| `api` | A | `YOUR_VPS_IP` |

Wait 5–30 minutes, then check:

```bash
ping parrotmoc.online
ping api.parrotmoc.online
```

---

## Part 2 — Connect to VPS and install Docker

```bash
ssh root@YOUR_VPS_IP
```

```bash
apt update && apt upgrade -y
apt install -y git curl nano ufw

curl -fsSL https://get.docker.com | sh

# Allow your user to run docker (if not root)
usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

Firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

---

## Part 3 — Clone the project

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/kass2024/xander-ai-ide.git
cd xander-ai-ide
```

---

## Part 4 — Create `.env.production` (copy from local)

```bash
cp .env.production.example .env.production
nano .env.production
```

### 4.1 Database (must match docker-compose)

Use the **same database name** as local (`xander_ai_ide`), but a **strong password** on the server:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE
POSTGRES_DB=xander_ai_ide
DATABASE_URL=postgresql://postgres:YOUR_STRONG_PASSWORD_HERE@postgres:5432/xander_ai_ide
```

> **Important:** Host is `postgres` (Docker service name), **not** `localhost`.

### 4.2 Redis & Qdrant (Docker internal URLs)

```env
REDIS_URL=redis://redis:6379
QDRANT_URL=http://qdrant:6333
```

### 4.3 Copy from your local `apps/backend/.env`

```env
OPENAI_API_KEY=sk-...          # same as local
ANTHROPIC_API_KEY=...          # optional
GEMINI_API_KEY=...             # optional

JWT_SECRET=...                 # NEW strong secret on VPS (openssl rand -base64 48)

STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...      # create NEW webhook for production URL

WEB_URL=https://parrotmoc.online
NEXT_PUBLIC_API_URL=https://api.parrotmoc.online

RUN_SEED=true                  # creates plans + admin on first deploy

ADMIN_EMAIL=admin@parrotmoc.online
ADMIN_PASSWORD=YOUR_STRONG_ADMIN_PASSWORD

AI_RATE_LIMIT_PER_MIN=60
NODE_ENV=production
```

Generate JWT secret on VPS:

```bash
openssl rand -base64 48
```

### 4.4 Stripe webhook (production)

Stripe Dashboard → Developers → Webhooks → Add endpoint:

- **URL:** `https://api.parrotmoc.online/billing/webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`

Copy `whsec_...` → `STRIPE_WEBHOOK_SECRET` in `.env.production`.

---

## Part 5 — Deploy with Docker (database + migrations automatic)

First deploy takes **5–15 minutes** (builds backend + web images).

```bash
cd /opt/xander-ai-ide
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### What happens automatically

1. **postgres** starts → empty database in volume `xander_postgres_data`
2. **redis** and **qdrant** start
3. **backend** builds and starts → entrypoint runs:
   - `npx prisma migrate deploy` → applies `apps/backend/prisma/migrations/`
   - `npx tsx prisma/seed.ts` (if `RUN_SEED=true`) → Free/Pro/Team/Enterprise plans + admin user
   - `node dist/main.js` → API on port 3001
4. **web** builds (with `NEXT_PUBLIC_API_URL`) → dashboard on port 3000
5. **nginx** routes:
   - `parrotmoc.online` → web
   - `api.parrotmoc.online` → backend

### Watch progress

```bash
docker compose -f docker-compose.prod.yml ps
docker logs -f xander_postgres
docker logs -f xander_backend
```

Wait until backend log shows:

```
==> Running Prisma migrations...
==> Seeding database...
Seeded plans: free, pro, team, enterprise
Seeded admin user: admin@parrotmoc.online
==> Starting NestJS...
🚀 Backend API running on http://localhost:3001
```

---

## Part 6 — Verify database (same schema as local)

### 6.1 Health check

```bash
curl -s http://api.parrotmoc.online/health | jq .
```

Expected:

```json
{
  "status": "ok",
  "checks": { "database": true, "redis": true }
}
```

### 6.2 List tables inside Postgres

```bash
docker exec -it xander_postgres psql -U postgres -d xander_ai_ide -c "\dt"
```

You should see: `users`, `plans`, `subscriptions`, `conversations`, `messages`, etc.

### 6.3 Check migration history

```bash
docker exec xander_backend npx prisma migrate status
```

Should show: **Database schema is up to date**.

### 6.4 Check seeded plans

```bash
docker exec -it xander_postgres psql -U postgres -d xander_ai_ide -c "SELECT slug, name, price FROM plans;"
```

### 6.5 Test login (admin from seed)

Open in browser: `http://parrotmoc.online/auth/login`

- Email: value of `ADMIN_EMAIL` in `.env.production`
- Password: value of `ADMIN_PASSWORD`

---

## Part 7 — Verify web + API

| Test | Command / URL |
|------|----------------|
| Web home | http://parrotmoc.online |
| API health | http://api.parrotmoc.online/health |
| Register | http://parrotmoc.online/auth/register |

---

## Part 8 — HTTPS (recommended before going live)

### Option A — Cloudflare (easiest)

1. Add site `parrotmoc.online` to Cloudflare
2. Point nameservers to Cloudflare
3. SSL/TLS → **Full**
4. Proxy enabled on `@`, `www`, `api`

### Option B — Let's Encrypt on VPS

```bash
apt install -y certbot
docker stop xander_nginx
certbot certonly --standalone \
  -d parrotmoc.online -d www.parrotmoc.online -d api.parrotmoc.online \
  --agree-tos -m your@email.com
docker start xander_nginx
```

Then configure nginx SSL (mount `/etc/letsencrypt` — see `DEPLOY-PARROTMOC.md`).

After HTTPS, update `.env.production` URLs to `https://` and rebuild web:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build web
```

---

## Part 9 — Manual database commands (if needed)

Same as local, but run **inside** the backend container:

```bash
# Apply migrations only
docker exec xander_backend npx prisma migrate deploy

# Run seed again (safe — uses upsert)
docker exec xander_backend npx tsx prisma/seed.ts

# Open Prisma Studio (temporary port forward)
docker exec -it xander_backend npx prisma studio
```

### Copy local database to VPS (optional)

Only if you want **existing local users/data** on the server:

**On your Windows PC** (with local Docker postgres running):

```powershell
docker exec xander_postgres pg_dump -U postgres xander_ai_ide > backup.sql
scp backup.sql root@YOUR_VPS_IP:/opt/
```

**On VPS:**

```bash
docker exec -i xander_postgres psql -U postgres -d xander_ai_ide < /opt/backup.sql
```

> Fresh VPS deploy with `RUN_SEED=true` is usually enough; you do **not** need to copy local DB unless you have real user data to preserve.

---

## Part 10 — Update after code changes

```bash
cd /opt/xander-ai-ide
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Migrations run automatically on every backend restart.

Set `RUN_SEED=false` after first deploy to avoid re-running seed on every update.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend keeps restarting | `docker logs xander_backend` — often wrong `DATABASE_URL` password |
| `Can't reach database` | Wait for postgres healthy: `docker ps` |
| Migrations failed | `docker exec xander_backend npx prisma migrate deploy` |
| Web shows wrong API | Rebuild web: `NEXT_PUBLIC_API_URL` must be set **before** `npm run build` in Docker |
| 502 on domain | DNS not pointing to VPS, or nginx/backend not healthy |
| Seed admin can't login | Check `ADMIN_EMAIL` / `ADMIN_PASSWORD`, run seed again |
| Out of memory on build | Add swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile` |

---

## Quick command reference

```bash
cd /opt/xander-ai-ide

# Status
docker compose -f docker-compose.prod.yml ps

# Logs
docker logs -f xander_backend
docker logs -f xander_web
docker logs -f xander_nginx

# Restart one service
docker compose -f docker-compose.prod.yml restart backend

# Stop everything
docker compose -f docker-compose.prod.yml down

# Stop and DELETE all data (danger!)
docker compose -f docker-compose.prod.yml down -v
```
