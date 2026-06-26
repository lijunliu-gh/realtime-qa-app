# Start backend (FastAPI) and frontend (Vite) in parallel.
# Usage: .\start-dev.ps1

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# --- Backend ---
$backendJob = Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$root\backend'; & '.\.venv\Scripts\Activate.ps1'; python -m uvicorn main:app --reload --port 8000"
) -PassThru

# --- Frontend ---
$frontendJob = Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$root\frontend'; npx.cmd vite --port 5173"
) -PassThru

Write-Host ""
Write-Host "=== RealtimeQA Dev Servers ===" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8000  (PID $($backendJob.Id))" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173  (PID $($frontendJob.Id))" -ForegroundColor Green
Write-Host ""
Write-Host "Close the spawned terminal windows to stop." -ForegroundColor DarkGray
