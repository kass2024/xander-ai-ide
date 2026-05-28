# Fix 502 Bad Gateway after `.env.production` update

## Root cause

| What you pasted (`.env.linux` old) | What VPS Postgres actually uses |
|-----------------------------------|--------------------------------|
| `POSTGRES_PASSWORD=postgres` | `change_this_strong_password` (first deploy default) |

Backend cannot run migrations → container stops → **502** on `https://api.xanderai.online`.

## Fix on VPS (5 minutes)

```bash
cd /opt/xander-ai-ide

# 1) Confirm backend is crashing (expect DB / Prisma errors)
docker logs xander_backend --tail 40

# 2) Edit env — MUST fix POSTGRES_PASSWORD line
nano .env.production
```

Set this line **exactly**:

```env
POSTGRES_PASSWORD=change_this_strong_password
```

Paste the rest from the corrected `C:\Users\user\xander-ai-ide\.env.linux` on your PC (or only change that one line and keep your API keys).

```bash
# 3) Restart backend (postgres/redis stay up)
docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml --env-file .env.production up -d backend

# 4) Wait ~30s, then check logs (should see "Starting NestJS...")
docker logs xander_backend --tail 30

# 5) Health must return JSON, not 502
curl -s https://api.xanderai.online/health
```

Expected:

```json
{"status":"ok","checks":{"database":true,"redis":true}}
```

## If POSTGRES_PASSWORD was something else on your VPS

Before editing, check what you had **before** the broken deploy:

```bash
grep POSTGRES_PASSWORD /opt/xander-ai-ide/.env.production
# or from git history on server if you never committed secrets:
# use the password that was working when health was OK
```

Use **that** value, not `postgres` from local dev.

## After API is online

1. **Desktop:** Settings → General → API `https://api.xanderai.online` → **● Online** → Sign in.
2. **Web:** https://xanderai.online/auth/login — same email/password as desktop.

## Safe rule for future env updates

When copying keys from `apps/backend/.env` (local):

| Copy to VPS | Do NOT copy from local |
|-------------|-------------------------|
| OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY | DATABASE_URL (localhost) |
| STRIPE_* | POSTGRES_PASSWORD=postgres |
| JWT_SECRET (optional) | REDIS_URL=redis://localhost |
| | QDRANT_URL=http://localhost:6333 |

Always keep VPS:

```env
POSTGRES_PASSWORD=change_this_strong_password
REDIS_URL=redis://redis:6379
QDRANT_URL=http://qdrant:6333
WEB_URL=https://xanderai.online
NEXT_PUBLIC_API_URL=https://api.xanderai.online
```
