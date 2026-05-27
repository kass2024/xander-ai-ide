# Your turn: server only (local work is done)

Everything below is what **you** run on the VPS. Local prep is complete when this checklist passes.

---

## What was done on your PC (already)

- [x] Code pushed to https://github.com/kass2024/xander-ai-ide
- [x] Production Docker + nginx configured for **parrotmoc.online**
- [x] Guides: `VPS-PRODUCTION-FULL-GUIDE.md`, `DEPLOY-SERVER-QUICK.md`

---

## Before SSH: 2 minutes on Windows

### 1. DNS (domain panel)

| Host | Type | Value |
|------|------|--------|
| `@` | A | VPS IP |
| `www` | A | VPS IP |
| `api` | A | VPS IP |

### 2. Generate server env file (optional, copies your local API keys)

```powershell
cd C:\Users\user\xander-ai-ide
.\scripts\prepare-server-env.ps1
```

Creates **`server-deploy.env`** (not in git). Upload to VPS:

```powershell
scp server-deploy.env root@YOUR_VPS_IP:/opt/xander-ai-ide/.env.production
```

Or on VPS: `cp .env.production.example .env.production` and edit manually.

### 3. Stripe webhook (after API is live)

URL: `https://api.parrotmoc.online/billing/webhook`  
Then update `STRIPE_WEBHOOK_SECRET` in `.env.production` on VPS.

---

## On the VPS — copy/paste order

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

# 2. Clone
cd /opt && git clone https://github.com/kass2024/xander-ai-ide.git && cd xander-ai-ide

# 3. Env (if you did not scp server-deploy.env)
cp .env.production.example .env.production
nano .env.production   # passwords, keys, parrotmoc.online URLs

# 4. Deploy (DB + migrations automatic)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 5. Wait & verify
docker logs -f xander_backend
curl -s http://api.parrotmoc.online/health
```

Login: https://parrotmoc.online/auth/login with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### After first success

```bash
# Stop re-seeding on every restart
nano .env.production   # set RUN_SEED=false
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### HTTPS

Use **Cloudflare** (easiest) or Certbot — see `VPS-PRODUCTION-FULL-GUIDE.md` Part 8.

---

## Full detail

Read **`VPS-PRODUCTION-FULL-GUIDE.md`** in the repo.
