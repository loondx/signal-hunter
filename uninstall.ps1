# Signal Hunter — Uninstaller (Windows)
# Usage: .\uninstall.ps1

$ErrorActionPreference = 'Stop'
$InstallDir = if ($env:SIGNAL_HUNTER_HOME) { $env:SIGNAL_HUNTER_HOME }
              else { Join-Path $env:APPDATA 'signal-hunter' }

Write-Host ""
Write-Host "  Signal Hunter — Uninstall (Windows)" -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "  Remove Signal Hunter? Config and signals will also be deleted. [y/N]"
if ($confirm.ToLower() -ne 'y') { Write-Host "  Cancelled."; exit 0 }

# Stop daemon if running
$pidFile = Join-Path $InstallDir 'data\cron.pid'
if (Test-Path $pidFile) {
    $pid = [int](Get-Content $pidFile -ErrorAction SilentlyContinue)
    if ($pid) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓  Stopped daemon (PID $pid)" -ForegroundColor Green
        } catch {}
    }
}

# Remove install directory
if (Test-Path $InstallDir) {
    Remove-Item $InstallDir -Recurse -Force
    Write-Host "  ✓  Removed $InstallDir" -ForegroundColor Green
}

# Remove from PATH
$binDir = Join-Path $InstallDir 'bin'
$currentPath = [Environment]::GetEnvironmentVariable('Path', 'User') ?? ''
if ($currentPath -like "*$binDir*") {
    $newPath = ($currentPath -split ';' | Where-Object { $_ -ne $binDir }) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "  ✓  Removed from PATH" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Signal Hunter removed." -ForegroundColor Green
Write-Host ""
