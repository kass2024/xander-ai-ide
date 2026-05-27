# Local preparation — completed

Date: ready for VPS deploy by you.

## Verified on this machine

| Check | Result |
|-------|--------|
| Git pushed | https://github.com/kass2024/xander-ai-ide (branch `main`) |
| Docker infra | postgres, redis, qdrant running |
| Prisma migrations | Up to date (`20260524120000_production_init`) |
| Database seed | Plans: free, pro, team, enterprise + admin user |
| Production build | backend + web + desktop — OK |

## Your next step

Open **`YOU-CONFIGURE-SERVER.md`** — only VPS commands you need.

## Optional: upload env to server

```powershell
cd C:\Users\user\xander-ai-ide
.\scripts\prepare-server-env.ps1
scp server-deploy.env root@YOUR_VPS_IP:/opt/xander-ai-ide/.env.production
```

## Local dev (keep using)

```powershell
# Infra (already running)
docker compose up -d

# Backend
cd apps\backend
npm run dev

# Web (another terminal)
cd apps\web
npm run dev

# Desktop (another terminal)
cd apps\desktop
npm run dev
```

## Desktop .exe (Windows users)

`apps\desktop\release\Xander AI IDE-Setup-1.0.0.exe`

After VPS is live, rebuild desktop with API URL or users sign in against production API manually.
