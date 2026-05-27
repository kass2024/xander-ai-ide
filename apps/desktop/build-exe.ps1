Write-Host "Building Xander AI IDE..." -ForegroundColor Green
Set-Location $PSScriptRoot

Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "Building application..." -ForegroundColor Yellow
npm run build

Write-Host "Packaging executable..." -ForegroundColor Yellow
npm run package

Write-Host "Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your executable should be in the 'release' folder:" -ForegroundColor Cyan
Write-Host "- Xander AI IDE Setup.exe" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
