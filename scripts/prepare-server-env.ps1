# Builds server-deploy.env from .env.linux (live credentials — NOT committed to git)
# Usage:  .\scripts\prepare-server-env.ps1

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sourceEnv = Join-Path $repoRoot ".env.linux"
$outFile = Join-Path $repoRoot "server-deploy.env"

if (-not (Test-Path $sourceEnv)) {
    Write-Host "ERROR: Missing $sourceEnv — add your live VPS credentials there." -ForegroundColor Red
    exit 1
}

$lines = Get-Content $sourceEnv
$map = @{}
foreach ($line in $lines) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $k, $v = $line -split '=', 2
    $map[$k.Trim()] = $v.Trim().Trim('"')
}

function Get-Val([string]$key, [string]$default = '') {
    if ($map.ContainsKey($key) -and $map[$key]) { return $map[$key] }
    return $default
}

$dbPass = Get-Val 'POSTGRES_PASSWORD' 'change_this_strong_password'
$jwt = Get-Val 'JWT_SECRET' ([Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]]))
$adminPass = Get-Val 'ADMIN_PASSWORD' 'admin123'
$geminiKey = Get-Val 'GEMINI_API_KEY' (Get-Val 'GOOGLE_AI_API_KEY')
$googleKey = Get-Val 'GOOGLE_AI_API_KEY' $geminiKey
$geminiModel = Get-Val 'GEMINI_MODEL' 'gemini-2.5-flash'

$defaultAdminEmail = "admin@xanderai.online"

$rows = @(
    "# Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm') from .env.linux",
    "# Upload: scp .env.production root@YOUR_VPS:/opt/xander-ai-ide/.env.production",
    "",
    "NODE_ENV=production",
    "",
    "POSTGRES_USER=$(Get-Val 'POSTGRES_USER' 'postgres')",
    "POSTGRES_PASSWORD=$dbPass",
    "POSTGRES_DB=$(Get-Val 'POSTGRES_DB' 'xander_ai_ide')",
    "",
    "JWT_SECRET=$jwt",
    "PORT=3001",
    "WEB_URL=$(Get-Val 'WEB_URL' 'https://xanderai.online')",
    "NEXT_PUBLIC_API_URL=$(Get-Val 'NEXT_PUBLIC_API_URL' 'https://api.xanderai.online')",
    "",
    "OPENAI_API_KEY=$(Get-Val 'OPENAI_API_KEY')",
    "OPENAI_MODEL_AGENT=$(Get-Val 'OPENAI_MODEL_AGENT' 'gpt-4o')",
    "OPENAI_MODEL_FAST=$(Get-Val 'OPENAI_MODEL_FAST' 'gpt-4o-mini')",
    "OPENAI_EMBEDDING_MODEL=$(Get-Val 'OPENAI_EMBEDDING_MODEL' 'text-embedding-3-small')",
    "",
    "ANTHROPIC_API_KEY=$(Get-Val 'ANTHROPIC_API_KEY')",
    "ANTHROPIC_MODEL=$(Get-Val 'ANTHROPIC_MODEL' 'claude-sonnet-4-20250514')",
    "",
    "GEMINI_API_KEY=$geminiKey",
    "GOOGLE_AI_API_KEY=$googleKey",
    "GEMINI_MODEL=$geminiModel",
    "GOOGLE_AI_MODEL=$(Get-Val 'GOOGLE_AI_MODEL' $geminiModel)",
    "",
    "DEEPSEEK_API_KEY=$(Get-Val 'DEEPSEEK_API_KEY')",
    "GROQ_API_KEY=$(Get-Val 'GROQ_API_KEY')",
    "MISTRAL_API_KEY=$(Get-Val 'MISTRAL_API_KEY')",
    "LLM_PROVIDER=$(Get-Val 'LLM_PROVIDER' 'openai')",
    "",
    "STRIPE_SECRET_KEY=$(Get-Val 'STRIPE_SECRET_KEY')",
    "STRIPE_PUBLISHABLE_KEY=$(Get-Val 'STRIPE_PUBLISHABLE_KEY')",
    "STRIPE_WEBHOOK_SECRET=$(Get-Val 'STRIPE_WEBHOOK_SECRET')",
    "",
    "REDIS_URL=redis://redis:6379",
    "QDRANT_URL=http://qdrant:6333",
    "AI_RATE_LIMIT_PER_MIN=$(Get-Val 'AI_RATE_LIMIT_PER_MIN' '60')",
    "RUN_SEED=$(Get-Val 'RUN_SEED' 'false')",
    "",
    "ADMIN_EMAIL=$(Get-Val 'ADMIN_EMAIL' $defaultAdminEmail)",
    "ADMIN_PASSWORD=$adminPass",
    "CERTBOT_EMAIL=$(Get-Val 'CERTBOT_EMAIL' $defaultAdminEmail)"
)

Set-Content -Path $outFile -Value ($rows -join "`n") -Encoding UTF8
Copy-Item -Path $outFile -Destination (Join-Path $repoRoot ".env.production") -Force
Write-Host "Created: $outFile" -ForegroundColor Green
Write-Host "Synced:  .env.production (from .env.linux)" -ForegroundColor Green
Write-Host "Upload:  scp .env.production root@YOUR_VPS:/opt/xander-ai-ide/.env.production"
