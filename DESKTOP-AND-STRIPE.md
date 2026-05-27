# Desktop app + Stripe webhook — xanderai.online

## Part A — Desktop `.exe` → production API

The API URL is set at **build time** (`VITE_API_URL`), not in Settings after install.

### On your Windows PC

```powershell
cd C:\Users\user\xander-ai-ide\apps\desktop

# Option 1: one-line env for this build
$env:VITE_API_URL="https://api.xanderai.online"
npm run dist:win

# Option 2: copy example env file
copy .env.production.example .env.production
npm run dist:win
```

Installer output:

`apps\desktop\release\Xander AI IDE-Setup-1.0.0.exe`

Install and sign in — requests go to `https://api.xanderai.online`.

### Verify API from PC

```powershell
curl -s https://api.xanderai.online/health
```

---

## Part B — Stripe webhook (VPS)

### 1. Stripe Dashboard

1. https://dashboard.stripe.com → **Developers** → **Webhooks**
2. **Add endpoint**
3. **Endpoint URL:** `https://api.xanderai.online/billing/webhook`
4. **Events to send** (select these):
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. **Add endpoint**

### 2. Copy signing secret

- Open the new endpoint → **Signing secret** → Reveal → copy `whsec_...`

### 3. VPS `.env.production`

```bash
cd /opt/xander-ai-ide
nano .env.production
```

Set (use your real Stripe keys):

```env
STRIPE_SECRET_KEY=sk_live_...   # or sk_test_... for test mode
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from step 2
```

Also ensure:

```env
WEB_URL=https://xanderai.online
NEXT_PUBLIC_API_URL=https://api.xanderai.online
```

Restart backend:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file .env.production up -d backend
```

### 4. Test webhook

In Stripe → your endpoint → **Send test webhook** → e.g. `checkout.session.completed`

On VPS:

```bash
docker logs xander_backend --tail 30
```

No `STRIPE_WEBHOOK_SECRET is required` errors.

### 5. Web billing (browser)

Uses `NEXT_PUBLIC_API_URL` from the **web** image build. If checkout on https://xanderai.online fails, rebuild web:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file .env.production build --no-cache web
docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file .env.production up -d web
```
