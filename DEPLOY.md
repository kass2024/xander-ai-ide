# VPS Production Deployment (Docker)

## Prerequisites

- VPS with Docker + Docker Compose v2
- Domain pointing to VPS (e.g. `yourdomain.com`, `api.yourdomain.com`)
- Stripe account with webhook endpoint configured

## 1. Configure environment

```bash
cp .env.production.example .env.production
# Edit .env.production — set JWT_SECRET, OPENAI_API_KEY, Stripe keys, passwords
```

## 2. Stripe webhook

In Stripe Dashboard → Developers → Webhooks:

- **Endpoint URL:** `https://api.yourdomain.com/billing/webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- Copy `whsec_...` into `STRIPE_WEBHOOK_SECRET` in `.env.production`

For local testing:

```bash
stripe listen --forward-to localhost:3001/billing/webhook
```

## 3. Deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

This starts: **postgres**, **redis**, **qdrant**, **backend**, **web**, **nginx**

Backend entrypoint automatically runs:
- `prisma migrate deploy`
- `prisma seed` (when `RUN_SEED=true`)

## 4. Verify

```bash
curl http://localhost/health          # via nginx → web
curl http://api.localhost/health      # backend health (database + redis checks)
```

Or on VPS with domains:

```bash
curl https://api.yourdomain.com/health
```

## 5. Admin access

Set in `.env.production`:

```
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_secure_password
RUN_SEED=true
```

Redeploy backend or run:

```bash
docker exec xander_backend npx tsx prisma/seed.ts
```

Admin API routes (JWT required, SUPER_ADMIN role):

- `GET /admin/users`
- `GET /admin/usage`
- `GET /admin/subscriptions`

## 6. Repository indexing (Qdrant)

```bash
POST /repo/index   { "rootPath": "/path/to/project" }
POST /repo/search  { "query": "authentication middleware" }
```

Requires `QDRANT_URL` and `OPENAI_API_KEY`.

## 7. SSL (recommended)

Add Certbot or Caddy in front of nginx, or use Cloudflare proxy with Full SSL.

## Dev infrastructure only

```bash
npm run docker:infra   # postgres + redis + qdrant on localhost ports
cd apps/backend && npx prisma migrate deploy && npx tsx prisma/seed.ts
```
