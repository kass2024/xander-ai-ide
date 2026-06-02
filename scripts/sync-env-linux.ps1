# Sync live credentials from .env.linux → .env.production (for VPS Docker deploy)
# Usage:  .\scripts\sync-env-linux.ps1

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$source = Join-Path $repoRoot ".env.linux"
$dest = Join-Path $repoRoot ".env.production"

if (-not (Test-Path $source)) {
    Write-Host "ERROR: Missing $source" -ForegroundColor Red
    exit 1
}

Copy-Item -Path $source -Destination $dest -Force
Write-Host "Synced: .env.linux -> .env.production" -ForegroundColor Green
Write-Host "Upload to VPS: scp .env.production root@YOUR_VPS:/opt/xander-ai-ide/.env.production"
