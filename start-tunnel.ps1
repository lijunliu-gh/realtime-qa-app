# Start dev tunnel for Teams integration (requires `devtunnel` CLI).
# Usage: .\start-tunnel.ps1
#
# Prerequisites:
#   winget install Microsoft.devtunnel
#   devtunnel user login

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host "Starting dev tunnel on port 5173..." -ForegroundColor Cyan

$tunnelJob = Start-Process powershell -ArgumentList @(
    '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command',
    "Set-Location '$root'; devtunnel host --port-numbers 5173 --allow-anonymous"
) -PassThru

Write-Host ""
Write-Host "=== Dev Tunnel ===" -ForegroundColor Cyan
Write-Host "  Tunnel PID: $($tunnelJob.Id)" -ForegroundColor Green
Write-Host "  Close the window to stop." -ForegroundColor DarkGray
