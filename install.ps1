# Signal Hunter — Windows Installer (PowerShell)
# Usage: irm https://raw.githubusercontent.com/loondx/signal-hunter/main/install.ps1 | iex
#
# Or download and run locally:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\install.ps1

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'  # speeds up Invoke-WebRequest

$REPO       = 'https://github.com/loondx/signal-hunter.git'
$BRANCH     = 'main'
$MIN_NODE   = 20
$InstallDir = if ($env:SIGNAL_HUNTER_HOME) { $env:SIGNAL_HUNTER_HOME }
              else { Join-Path $env:APPDATA 'signal-hunter' }
$BinDir     = Join-Path $InstallDir 'bin'

# ── Helpers ───────────────────────────────────────────────────────────────────
function ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function info($msg) { Write-Host "  -->  $msg" -ForegroundColor Cyan }
function warn($msg) { Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function die($msg)  { Write-Host "`n  [X]  $msg`n" -ForegroundColor Red; exit 1 }

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   Signal Hunter — Windows Installer" -ForegroundColor Cyan
Write-Host "   AI agent that hunts client leads for you" -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""

# ── Node.js check ─────────────────────────────────────────────────────────────
$nodeOk = $false
try {
    $ver = (node -e "process.stdout.write(String(parseInt(process.version.slice(1))))" 2>$null)
    if ([int]$ver -ge $MIN_NODE) { $nodeOk = $true }
} catch {}

if (-not $nodeOk) {
    warn "Node.js $MIN_NODE+ not found."
    Write-Host ""
    Write-Host "  Install Node.js first (choose one):" -ForegroundColor Yellow
    Write-Host "    winget install OpenJS.NodeJS.LTS" -ForegroundColor Cyan
    Write-Host "    OR download from: https://nodejs.org" -ForegroundColor Cyan
    Write-Host ""
    die "Node.js $MIN_NODE+ is required. Install it and re-run this script."
}
ok "Node.js $(node --version)"

# ── git check ─────────────────────────────────────────────────────────────────
try { git --version | Out-Null } catch {
    warn "git not found."
    Write-Host "  Install git:" -ForegroundColor Yellow
    Write-Host "    winget install Git.Git" -ForegroundColor Cyan
    die "git is required."
}
ok "git $(git --version | Select-String -Pattern '\d+\.\d+\.\d+' | % { $_.Matches[0].Value })"

# ── Clone or update ───────────────────────────────────────────────────────────
Write-Host ""
if (Test-Path (Join-Path $InstallDir '.git')) {
    info "Updating existing install at $InstallDir ..."
    git -C $InstallDir fetch --quiet 2>$null
    git -C $InstallDir reset --hard "origin/$BRANCH" --quiet 2>$null
    ok "Updated to latest"
} else {
    info "Installing to $InstallDir ..."
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    git clone --depth 1 --branch $BRANCH $REPO $InstallDir --quiet 2>$null
    ok "Source code cloned"
}

# ── npm install ───────────────────────────────────────────────────────────────
info "Installing dependencies (this may take a minute)..."
npm install --prefix $InstallDir --omit=dev --silent 2>$null
ok "Dependencies installed"

# ── Create bin directory and .cmd wrapper ────────────────────────────────────
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

$wrapperCmd = "@echo off`r`nset SIGNAL_HUNTER_HOME=$InstallDir`r`nnode ""%SIGNAL_HUNTER_HOME%\bin\cli.js"" %*`r`n"
$wrapperCmd | Set-Content (Join-Path $BinDir 'signal-hunter.cmd') -Encoding ASCII

# PowerShell wrapper (for running in PS without the .cmd extension)
$wrapperPs1 = "`$env:SIGNAL_HUNTER_HOME = '$InstallDir'`nnode `"`$env:SIGNAL_HUNTER_HOME\bin\cli.js`" @args`n"
$wrapperPs1 | Set-Content (Join-Path $BinDir 'signal-hunter.ps1') -Encoding UTF8

ok "CLI created at $BinDir\signal-hunter.cmd"

# ── Add BinDir to User PATH ───────────────────────────────────────────────────
$currentPath = [Environment]::GetEnvironmentVariable('Path', 'User') ?? ''
if ($currentPath -notlike "*$BinDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$BinDir;$currentPath", 'User')
    $env:PATH = "$BinDir;$env:PATH"
    warn "Added $BinDir to your PATH."
    warn "Restart your terminal (or open a new one) for signal-hunter to be available."
} else {
    ok "PATH already configured"
}

# ── Copy example configs ──────────────────────────────────────────────────────
$configDir = Join-Path $InstallDir 'config'
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'data') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'logs') | Out-Null

foreach ($name in @('businesses', 'sources')) {
    $dest = Join-Path $configDir "$name.yml"
    $src  = Join-Path $configDir "$name.example.yml"
    if (!(Test-Path $dest) -and (Test-Path $src)) { Copy-Item $src $dest }
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ================================================" -ForegroundColor Green
Write-Host "   Signal Hunter installed!" -ForegroundColor Green
Write-Host "  ================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Installed to : $InstallDir" -ForegroundColor DarkGray
Write-Host "  Your data    : $InstallDir\config\" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  NEXT STEP — run the setup wizard:" -ForegroundColor White
Write-Host ""
Write-Host "    signal-hunter setup" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Other commands:" -ForegroundColor DarkGray
Write-Host "    signal-hunter doctor   check everything is working" -ForegroundColor DarkGray
Write-Host "    signal-hunter scan     find your first leads" -ForegroundColor DarkGray
Write-Host "    signal-hunter --help   see all commands" -ForegroundColor DarkGray
Write-Host ""
