#!/usr/bin/env bash
# Signal Hunter — macOS / Linux Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/loondx/signal-hunter/main/install.sh | bash
#
# Supports: macOS (Homebrew / nvm), Linux (apt / nvm), and Git Bash on Windows
set -euo pipefail

REPO="https://github.com/loondx/signal-hunter.git"
BRANCH="main"
MIN_NODE=20
INSTALL_DIR="${SIGNAL_HUNTER_HOME:-$HOME/.signal-hunter}"

# ── Detect OS ─────────────────────────────────────────────────────────────────
OS="linux"
[[ "$OSTYPE" == "darwin"* ]] && OS="mac"
[[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* || "$OSTYPE" == "win32" ]] && OS="windows"

# ── Colors (only when attached to a terminal) ─────────────────────────────────
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
    CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; DIM=''; RESET=''
fi

ok()   { printf "  ${GREEN}✓${RESET}  %s\n" "$*"; }
info() { printf "  ${CYAN}→${RESET}  %s\n" "$*"; }
warn() { printf "  ${YELLOW}⚠${RESET}  %s\n" "$*"; }
die()  { printf "\n  ${RED}✗  %s${RESET}\n\n" "$*" >&2; exit 1; }
hr()   { printf "  ${DIM}────────────────────────────────────────────────────${RESET}\n"; }

# ── Banner ────────────────────────────────────────────────────────────────────
printf "\n${BOLD}${CYAN}"
cat << 'BANNER'
  ███████╗ ██╗  ██████╗  ███╗   ██╗  █████╗  ██╗
  ██╔════╝ ██║ ██╔════╝  ████╗  ██║ ██╔══██╗ ██║
  ███████╗ ██║ ██║  ███╗ ██╔██╗ ██║ ███████║ ██║
  ╚════██║ ██║ ██║   ██║ ██║╚██╗██║ ██╔══██║ ██║
  ███████║ ██║ ╚██████╔╝ ██║ ╚████║ ██║  ██║ ███████╗
  ╚══════╝ ╚═╝  ╚═════╝  ╚═╝  ╚═══╝ ╚═╝  ╚═╝ ╚══════╝
BANNER
printf "${RESET}"
printf "  ${BOLD}H U N T E R${RESET}  ${DIM}—${RESET}  ${BOLD}find paying clients before the job post${RESET}\n"
printf "  ${DIM}by loondx · github.com/loondx/signal-hunter${RESET}\n\n"
hr; printf "\n"

# ── Node.js ───────────────────────────────────────────────────────────────────
node_major() {
    node -e 'process.stdout.write(String(parseInt(process.version.slice(1))))' 2>/dev/null || echo "0"
}

install_node_mac() {
    if command -v brew &>/dev/null; then
        info "Installing Node.js via Homebrew..."
        brew install node@${MIN_NODE} --quiet 2>/dev/null || brew install node --quiet 2>/dev/null
        # Homebrew may not link it automatically
        brew link node@${MIN_NODE} --force --overwrite &>/dev/null || true
    elif [ -s "$NVM_DIR/nvm.sh" ] || [ -s "$HOME/.nvm/nvm.sh" ]; then
        _load_nvm
        nvm install $MIN_NODE --lts --no-progress 2>/dev/null
        nvm alias default $MIN_NODE --silent
    else
        die "Node.js $MIN_NODE+ not found.\n  Install: brew install node  or  https://nodejs.org"
    fi
}

install_node_linux() {
    if [ -s "$NVM_DIR/nvm.sh" ] || [ -s "$HOME/.nvm/nvm.sh" ]; then
        _load_nvm
        nvm install $MIN_NODE --lts --no-progress 2>/dev/null
        nvm alias default $MIN_NODE --silent
    elif command -v curl &>/dev/null; then
        info "Installing nvm + Node.js $MIN_NODE..."
        curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        # shellcheck disable=SC1091
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        nvm install $MIN_NODE --lts --no-progress 2>/dev/null
        nvm alias default $MIN_NODE --silent
    else
        die "Node.js $MIN_NODE+ not found.\n  Install: https://nodejs.org  or  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"
    fi
}

_load_nvm() {
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ]      && . "$NVM_DIR/nvm.sh"
    [ -s "$HOME/.nvm/nvm.sh" ]    && . "$HOME/.nvm/nvm.sh"
}

# Load nvm if it exists (needed when running via curl | bash)
_load_nvm 2>/dev/null || true

if command -v node &>/dev/null && [ "$(node_major)" -ge "$MIN_NODE" ]; then
    ok "Node.js $(node --version)"
else
    warn "Node.js $MIN_NODE+ not found — installing..."
    if [ "$OS" = "mac" ]; then
        install_node_mac
    elif [ "$OS" = "windows" ]; then
        die "On Windows: use install.ps1 instead.\n  irm https://raw.githubusercontent.com/loondx/signal-hunter/main/install.ps1 | iex"
    else
        install_node_linux
    fi

    # Re-check after install
    command -v node &>/dev/null && [ "$(node_major)" -ge "$MIN_NODE" ] \
        || die "Node.js install failed. Install manually: https://nodejs.org"
    ok "Node.js $(node --version) installed"
fi

# ── git ───────────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
    if [ "$OS" = "mac" ] && command -v brew &>/dev/null; then
        info "Installing git via Homebrew..."
        brew install git --quiet
    else
        die "git not found.\n  Linux: sudo apt install git   macOS: brew install git"
    fi
fi
ok "git $(git --version | awk '{print $3}')"

# ── Clone / update ────────────────────────────────────────────────────────────
printf "\n"
if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing install at ${CYAN}${INSTALL_DIR}${RESET}..."
    git -C "$INSTALL_DIR" fetch --quiet 2>/dev/null
    git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH" --quiet 2>/dev/null
    ok "Updated to latest"
else
    info "Installing to ${CYAN}${INSTALL_DIR}${RESET}..."
    git clone --depth 1 --branch "$BRANCH" "$REPO" "$INSTALL_DIR" --quiet 2>/dev/null
    ok "Source code cloned"
fi

# ── npm install ───────────────────────────────────────────────────────────────
info "Installing dependencies..."
npm install --prefix "$INSTALL_DIR" --omit=dev --silent 2>/dev/null
ok "Dependencies installed"

# ── Wrapper binary ────────────────────────────────────────────────────────────
# Try multiple bin locations in order of preference
BIN_DIRS=(
    "$HOME/.local/bin"           # standard XDG, works on Linux + modern macOS
    "$HOME/bin"                  # fallback used on some older systems
    "/usr/local/bin"             # macOS Homebrew default; needs sudo check
)

BIN_DIR=""
for d in "${BIN_DIRS[@]}"; do
    if [ -d "$d" ] && [ -w "$d" ]; then
        BIN_DIR="$d"; break
    fi
done

if [ -z "$BIN_DIR" ]; then
    # Create ~/.local/bin if nothing writable was found
    BIN_DIR="$HOME/.local/bin"
    mkdir -p "$BIN_DIR"
fi

cat > "$BIN_DIR/signal-hunter" << WRAPPER
#!/usr/bin/env bash
export SIGNAL_HUNTER_HOME="\${SIGNAL_HUNTER_HOME:-${INSTALL_DIR}}"
export SIGNAL_HUNTER_BIN="\$(basename "\$0")"
exec node "\$SIGNAL_HUNTER_HOME/bin/cli.js" "\$@"
WRAPPER
chmod +x "$BIN_DIR/signal-hunter"
ok "CLI created at ${CYAN}${BIN_DIR}/signal-hunter${RESET}"

# Short alias — `loondx` runs the same CLI
ln -sf "$BIN_DIR/signal-hunter" "$BIN_DIR/loondx"
ok "Short alias: ${CYAN}loondx${RESET}"

# ── PATH setup ────────────────────────────────────────────────────────────────
PATH_LINE="export PATH=\"\$HOME/.local/bin:\$HOME/bin:\$PATH\""
SHELLS_UPDATED=false

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    RCFILES=()
    [ -f "$HOME/.bashrc"    ] && RCFILES+=("$HOME/.bashrc")
    [ -f "$HOME/.zshrc"     ] && RCFILES+=("$HOME/.zshrc")
    [ -f "$HOME/.bash_profile" ] && RCFILES+=("$HOME/.bash_profile")
    [ -f "$HOME/.profile"   ] && ! grep -q '.local/bin' "$HOME/.profile" 2>/dev/null && RCFILES+=("$HOME/.profile")

    for rc in "${RCFILES[@]}"; do
        if ! grep -q '.local/bin' "$rc" 2>/dev/null; then
            { printf "\n# Signal Hunter\n%s\n" "$PATH_LINE"; } >> "$rc"
            SHELLS_UPDATED=true
        fi
    done
    export PATH="$BIN_DIR:$PATH"
fi

if $SHELLS_UPDATED; then
    warn "Added $BIN_DIR to PATH in your shell config"
    warn "Open a new terminal or run: ${CYAN}source ~/.bashrc${RESET} (or ~/.zshrc)"
else
    ok "PATH already configured"
fi

# ── Copy example configs ──────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR/config" "$INSTALL_DIR/data" "$INSTALL_DIR/logs"
for name in businesses sources; do
    dest="$INSTALL_DIR/config/$name.yml"
    src="$INSTALL_DIR/config/$name.example.yml"
    [ ! -f "$dest" ] && [ -f "$src" ] && cp "$src" "$dest"
done

# ── Done ──────────────────────────────────────────────────────────────────────
printf "\n"
hr
printf "\n"
printf "  ${GREEN}${BOLD}✓  Signal Hunter installed!${RESET}\n\n"
printf "  Installed to:  ${DIM}%s${RESET}\n"   "$INSTALL_DIR"
printf "  Config + data: ${DIM}%s/config${RESET}\n\n" "$INSTALL_DIR"
printf "  ${BOLD}Next step — run the setup wizard:${RESET}\n\n"
printf "    ${CYAN}${BOLD}signal-hunter setup${RESET}   ${DIM}(or the short alias: ${RESET}${CYAN}loondx setup${RESET}${DIM})${RESET}\n\n"
printf "  ${DIM}Other: signal-hunter doctor  |  signal-hunter scan  |  signal-hunter --help${RESET}\n\n"
hr
printf "\n"
