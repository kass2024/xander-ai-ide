# Builds server-deploy.env from local apps/backend/.env (NOT committed to git)
# Run on Windows before uploading to VPS:  .\scripts\prepare-server-env.ps1

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localEnv = Join-Path $repoRoot "apps\backend\.env"
$outFile = Join-Path $repoRoot "server-deploy.env"

if (-not (Test-Path $localEnv)) {
    Write-Host "ERROR: Missing $localEnv — copy apps/backend/.env.example to .env first." -ForegroundColor Red
    exit 1
}

$lines = Get-Content $localEnv
$map = @{}
foreach ($line in $lines) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $k, $v = $line -split '=', 2
    $map[$k.Trim()] = $v.Trim().Trim('"')
}

function Get-Val($key, $default = '') {
    if ($map.ContainsKey($key) -and $map[$key]) { return $map[$key] }
    return $default
}

$dbPass = Read-Host "Enter POSTGRES_PASSWORD for VPS (strong, new)"
$adminPass = Read-Host "Enter ADMIN_PASSWORD for VPS admin login"
$jwt = if ($map['JWT_SECRET']) { $map['JWT_SECRET'] } else { [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]]) }

$content = @"
# Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm') — upload to VPS as /opt/xander-ai-ide/.env.production
# scp server-deploy.env root@YOUR_VPS:/opt/xander-ai-ide/.env.production

NODE_ENV=production

POSTGRES_USER=postgres
POSTGRES_PASSWORD=$dbPass
POSTGRES_DB=xander_ai_ide
DATABASE_URL=postgresql://postgres:${dbPass}@postgres:5432/xander_ai_ide

REDIS_URL=redis://redis:6379
QDRANT_URL=http://qdrant:6333

OPENAI_API_KEY=$(Get-Val 'OPENAI_API_KEY')
OPENAI_MODEL_AGENT=$(Get-Val 'OPENAI_MODEL_AGENT' 'gpt-4o')
OPENAI_MODEL_FAST=$(Get-Val 'OPENAI_MODEL_FAST' 'gpt-4o-mini')
OPENAI_EMBEDDING_MODEL=$(Get-Val 'OPENAI_EMBEDDING_MODEL' 'text-embedding-3-small')

ANTHROPIC_API_KEY=$(Get-Val 'ANTHROPIC_API_KEY')
ANTHROPIC_MODEL=$(Get-Val 'ANTHROPIC_MODEL' 'claude-sonnet-4-20250514')

GEMINI_API_KEY=$(Get-Val 'GEMINI_API_KEY' $(Get-Val 'GOOGLE_AI_API_KEY'))
GEMINI_MODEL=$(Get-Val 'GEMINI_MODEL' 'gemini-2.0-flash')

JWT_SECRET=$jwt

STRIPE_SECRET_KEY=$(Get-Val 'STRIPE_SECRET_KEY')
STRIPE_PUBLISHABLE_KEY=$(Get-Val 'STRIPE_PUBLISHABLE_KEY')
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_AFTER_CREATING_STRIPE_WEBHOOK_ON_VPS

WEB_URL=https://parrotmoc.online
NEXT_PUBLIC_API_URL=https://api.parrotmoc.online

RUN_SEED=true
AI_RATE_LIMIT_PER_MIN=60

ADMIN_EMAIL=admin@parrotmoc.online
ADMIN_PASSWORD=$adminPass
"@

Set-Content -Path $outFile -Value $content -Encoding UTF8
Write-Host "Created: $outFile" -ForegroundColor Green
Write-Host "Upload: scp server-deploy.env root@YOUR_VPS_IP:/opt/xander-ai-ide/.env.production"
