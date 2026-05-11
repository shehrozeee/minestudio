# Deploy MineStudio to Cloudflare Pages
# Usage: pwsh scripts/deploy.ps1 [-Branch main|preview]
param(
    [string]$Branch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
Push-Location $root

try {
    Write-Host "==> Type-checking..." -ForegroundColor Cyan
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "Type check failed." }

    Write-Host "==> Building..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed." }

    Write-Host "==> Deploying to CF Pages (branch: $Branch)..." -ForegroundColor Cyan
    npx wrangler pages deploy dist --project-name minestudio --branch $Branch
    if ($LASTEXITCODE -ne 0) { throw "Wrangler deploy failed." }

    Write-Host "==> Done. Live at: https://minestudio.inniapps.com" -ForegroundColor Green
}
finally {
    Pop-Location
}
