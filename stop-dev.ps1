# Stop all RealtimeQA dev services (backend, frontend, tunnel).
# Usage: .\stop-dev.ps1

$pidFile = Join-Path $PSScriptRoot '.dev-pids'

if (-not (Test-Path $pidFile)) {
    Write-Host "No .dev-pids file found — nothing to stop." -ForegroundColor Yellow
    exit 0
}

$pids = Get-Content $pidFile | Where-Object { $_ -match '^\d+$' }
$stopped = 0

foreach ($p in $pids) {
    $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
    if ($proc) {
        # Kill process tree (handles uvicorn child processes)
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        $stopped++
        Write-Host "  Stopped PID $p ($($proc.ProcessName))" -ForegroundColor Green
    } else {
        Write-Host "  PID $p already gone" -ForegroundColor DarkGray
    }
}

Remove-Item $pidFile -Force
Write-Host ""
Write-Host "Stopped $stopped process(es). Cleaned up .dev-pids." -ForegroundColor Cyan
