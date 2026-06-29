# Start backend (FastAPI) and frontend (Vite) in parallel.
# Usage:
#   .\start-dev.ps1              # Foreground mode (windows visible, easy to debug)
#   .\start-dev.ps1 -Background  # Background mode (hidden windows, use stop-dev.ps1 to stop)

param(
    [switch]$Background
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$pidFile = Join-Path $root '.dev-pids'

if ($Background) {
    $windowStyle = 'Hidden'
} else {
    $windowStyle = 'Normal'
}

$noExit = if ($Background) { @() } else { @('-NoExit') }

# --- Backend ---
$backendArgs = $noExit + @(
    '-ExecutionPolicy', 'Bypass', '-Command',
    "Set-Location '$root\backend'; & '$root\backend\.venv\Scripts\python.exe' -m uvicorn main:app --reload --port 8000"
)
$backendJob = Start-Process powershell -ArgumentList $backendArgs -WindowStyle $windowStyle -PassThru

# --- Frontend ---
$frontendArgs = $noExit + @(
    '-ExecutionPolicy', 'Bypass', '-Command',
    "Set-Location '$root\frontend'; npx.cmd vite --port 5173"
)
$frontendJob = Start-Process powershell -ArgumentList $frontendArgs -WindowStyle $windowStyle -PassThru

# Save PIDs for stop-dev.ps1
@($backendJob.Id, $frontendJob.Id) | Set-Content $pidFile

Write-Host ""
Write-Host "=== RealtimeQA Dev Servers ===" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8000  (PID $($backendJob.Id))" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173  (PID $($frontendJob.Id))" -ForegroundColor Green
Write-Host "  Mode:     $(if ($Background) { 'Background (hidden)' } else { 'Foreground (windows visible)' })" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Stop with: .\stop-dev.ps1" -ForegroundColor DarkGray
