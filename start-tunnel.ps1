# Start dev tunnel for Teams integration (requires `devtunnel` CLI).
# Usage:
#   .\start-tunnel.ps1              # Foreground mode (window visible)
#   .\start-tunnel.ps1 -Background  # Background mode (hidden, use stop-dev.ps1 to stop)
#
# Prerequisites:
#   winget install Microsoft.devtunnel
#   devtunnel user login
#   Create .env from .env.example with your TUNNEL_NAME

param(
    [switch]$Background
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$pidFile = Join-Path $root '.dev-pids'

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

if ($Background) {
    $windowStyle = 'Hidden'
} else {
    $windowStyle = 'Normal'
}

$noExit = if ($Background) { @() } else { @('-NoExit') }

$tunnelArgs = $noExit + @(
    '-ExecutionPolicy', 'Bypass', '-Command',
    "Set-Location '$root'; devtunnel host $tunnelName --allow-anonymous"
)
$tunnelJob = Start-Process powershell -ArgumentList $tunnelArgs -WindowStyle $windowStyle -PassThru

# Append PID to .dev-pids (start-dev.ps1 may have already written backend/frontend PIDs)
$tunnelJob.Id | Add-Content $pidFile

Write-Host ""
Write-Host "=== Dev Tunnel ===" -ForegroundColor Cyan
Write-Host "  Tunnel:   $tunnelName" -ForegroundColor Green
Write-Host "  Tunnel PID: $($tunnelJob.Id)" -ForegroundColor Green
Write-Host "  Mode:     $(if ($Background) { 'Background (hidden)' } else { 'Foreground (window visible)' })" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Stop with: .\stop-dev.ps1" -ForegroundColor DarkGray
