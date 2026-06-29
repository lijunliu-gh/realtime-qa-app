# Start dev tunnel for Teams integration (requires `devtunnel` CLI).
# Usage: .\start-tunnel.ps1
#
# Prerequisites:
#   winget install Microsoft.devtunnel
#   devtunnel user login
#   Create .env from .env.example with your TUNNEL_NAME

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# Load TUNNEL_NAME from .env
$envFile = Join-Path $root '.env'
$tunnelName = ''
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*TUNNEL_NAME\s*=\s*(.+)$') {
            $tunnelName = $Matches[1].Trim()
        }
    }
}
if (-not $tunnelName) {
    Write-Host "ERROR: TUNNEL_NAME not found in .env" -ForegroundColor Red
    Write-Host "  cp .env.example .env  # then set TUNNEL_NAME" -ForegroundColor Yellow
    exit 1
}

Write-Host "Starting dev tunnel '$tunnelName'..." -ForegroundColor Cyan

$tunnelJob = Start-Process powershell -ArgumentList @(
    '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command',
    "Set-Location '$root'; devtunnel host $tunnelName --allow-anonymous"
) -PassThru

Write-Host ""
Write-Host "=== Dev Tunnel ===" -ForegroundColor Cyan
Write-Host "  Tunnel:   $tunnelName" -ForegroundColor Green
Write-Host "  Tunnel PID: $($tunnelJob.Id)" -ForegroundColor Green
Write-Host "  Close the window to stop." -ForegroundColor DarkGray
