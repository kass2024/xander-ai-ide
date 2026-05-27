# Deploy Xander AI IDE on Linux VPS — parrotmoc.online

This guide deploys the **web dashboard** and **API backend** with Docker + Nginx virtual hosts.

| URL | Service |
|-----|---------|
| https://parrotmoc.online | Next.js web (billing, login, dashboard) |
| https://www.parrotmoc.online | Same (redirect or alias) |
| https://api.parrotmoc.online | NestJS backend (AI, auth, Stripe webhooks) |

The **Electron desktop IDE** is built on Windows only; users install the `.exe` locally and point it at `https://api.parrotmoc.online`.

---

## Part A — Push project to Git (from your PC)

### Step 1: Create an empty repository on GitHub

1. Go to https://github.com/new
2. Name: e.g. `xander-ai-ide`
3. **Do not** add README, .gitignore, or license (repo already has files)
4. Copy the repo URL, e.g. `https://github.com/YOUR_USERNAME/xander-ai-ide.git`

### Step 2: First commit (already prepared in project root)

```powershell
cd C:\Users\user\xander-ai-ide

git add .
git status
# Confirm .env and node_modules are NOT listed

git commit -m "Initial commit: Xander AI IDE monorepo with agent tools and production Docker deploy"
```

### Step 3: Connect remote and push

```powershell
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/xander-ai-ide.git
git push -u origin main
```

Use a **Personal Access Token** as password if GitHub asks (Settings → Developer settings → Tokens).

---

## Part B — DNS (before VPS deploy)

At your domain registrar (where `parrotmoc.online` is managed), add **A records**:

| Host | Type | Value |
|------|------|--------|
| `@` | A | `YOUR_VPS_IP` |
| `www` | A | `YOUR_VPS_IP` |
| `api` | A | `YOUR_VPS_IP` |

Wait 5–30 minutes for DNS to propagate. Check:

```bash
ping parrotmoc.online
ping api.parrotmoc.online
```

---

## Part C — Prepare the Linux VPS

### Step 1: SSH into the server

```bash
ssh root@YOUR_VPS_IP
# or: ssh ubuntu@YOUR_VPS_IP
```

### Step 2: Install Docker

**Ubuntu 22.04 / 24.04:**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version
```

### Step 3: Open firewall ports

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## Part D — Clone and configure on VPS

### Step 1: Clone from Git

```bash
cd /opt
sudo git clone https://github.com/YOUR_USERNAME/xander-ai-ide.git
sudo chown -R $USER:$USER xander-ai-ide
cd xander-ai-ide
```

### Step 2: Create production environment file

```bash
cp .env.production.example .env.production
nano .env.production
```

Set at minimum:

```env
POSTGRES_PASSWORD=STRONG_DB_PASSWORD_HERE
JWT_SECRET=PASTE_OUTPUT_OF_openssl_rand_base64_48

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...   # optional
GEMINI_API_KEY=...             # optional

STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

WEB_URL=https://parrotmoc.online
NEXT_PUBLIC_API_URL=https://api.parrotmoc.online

ADMIN_EMAIL=admin@parrotmoc.online
ADMIN_PASSWORD=STRONG_ADMIN_PASSWORD
RUN_SEED=true
```

Generate JWT secret:

```bash
openssl rand -base64 48
```

### Step 3: Stripe webhook

In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks):

- **URL:** `https://api.parrotmoc.online/billing/webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- Copy signing secret → `STRIPE_WEBHOOK_SECRET` in `.env.production`

---

## Part E — Deploy with Docker

### Step 1: Build and start (HTTP first)

```bash
cd /opt/xander-ai-ide
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Wait 3–10 minutes for first build. Check:

```bash
docker compose -f docker-compose.prod.yml ps
docker logs xander_backend --tail 50
docker logs xander_web --tail 30
```

### Step 2: Verify HTTP

```bash
curl -s http://localhost/health
curl -s http://api.parrotmoc.online/health
# From your PC browser: http://parrotmoc.online
```

---

## Part F — SSL (HTTPS) with Certbot

Stop nginx container briefly so Certbot can use port 80, **or** use webroot (recommended below).

### Option 1: Certbot on host (simple)

```bash
sudo apt install -y certbot

# Stop docker nginx temporarily
docker stop xander_nginx

sudo certbot certonly --standalone -d parrotmoc.online -d www.parrotmoc.online -d api.parrotmoc.online --agree-tos -m your@email.com

# Certificates are in:
# /etc/letsencrypt/live/parrotmoc.online/fullchain.pem
# /etc/letsencrypt/live/parrotmoc.online/privkey.pem
```

Add SSL to `docker-compose.prod.yml` nginx service volumes:

```yaml
    volumes:
      - ./nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

Update `nginx.prod.conf` with SSL server blocks (see `nginx.prod.ssl.conf.example` in repo if added), then:

```bash
docker start xander_nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### Option 2: Cloudflare (easiest)

1. Add site `parrotmoc.online` to Cloudflare
2. Point nameservers to Cloudflare
3. SSL/TLS → **Full** or **Full (strict)**
4. Orange-cloud proxy on `@`, `www`, `api`
5. Origin connects to VPS on port 80 (HTTP) — Cloudflare terminates HTTPS

Renew certbot auto:

```bash
sudo certbot renew --dry-run
```

---

## Part G — Desktop app API URL

Users running **Xander AI IDE** on Windows must reach your API:

1. Build desktop with API URL baked in, or set at runtime via env:
   - `VITE_API_URL=https://api.parrotmoc.online` when building web/desktop if applicable
2. In packaged app, default is often `http://localhost:3001` — for production distribute a config or rebuild with:

```powershell
# On Windows build machine
$env:VITE_API_URL="https://api.parrotmoc.online"
cd apps\desktop
npm run build
npm run dist:win
```

Sign in on desktop uses the same backend auth as the web dashboard.

---

## Part H — Maintenance commands

```bash
cd /opt/xander-ai-ide

# Pull updates
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Logs
docker logs -f xander_backend
docker logs -f xander_nginx

# DB migrate only
docker exec xander_backend npx prisma migrate deploy

# Restart one service
docker compose -f docker-compose.prod.yml restart backend
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Can't reach database` | `docker logs xander_postgres`, wait for healthy |
| 502 Bad Gateway | `docker ps`, ensure backend health is green |
| Stripe webhook fails | URL must be `https://api.parrotmoc.online/billing/webhook`, raw body |
| CORS errors from desktop | Backend must allow origin; check `main.ts` CORS for your domain |
| DNS not resolving | Wait for propagation; verify A records |

---

## Quick checklist

- [ ] Git pushed to GitHub (no `.env` in repo)
- [ ] DNS: `@`, `www`, `api` → VPS IP
- [ ] `.env.production` filled on VPS
- [ ] `docker compose ... up -d --build` succeeds
- [ ] `https://api.parrotmoc.online/health` returns OK
- [ ] `https://parrotmoc.online` loads dashboard
- [ ] Stripe webhook configured
- [ ] SSL enabled (Certbot or Cloudflare)
