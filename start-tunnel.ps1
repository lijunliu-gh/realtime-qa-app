# Start dev tunnel for Teams integration (requires `devtunnel` CLI).
# Usage: .\start-tunnel.ps1
#
# Prerequisites:
#   winget install Microsoft.devtunnel
#   devtunnel user login

$ErrorActionPreference = 'Stop'

Write-Host "Starting dev tunnel on port 5173..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

devtunnel host --port-numbers 5173 --allow-anonymous
