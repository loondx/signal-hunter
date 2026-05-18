#!/usr/bin/env bash
# Signal Hunter — One-command installer
# Usage: curl -fsSL https://raw.githubusercontent.com/loondx/signal-hunter/main/install.sh | bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
INSTALL_DIR="${SIGNAL_HUNTER_HOME:-$HOME/.signal-hunter}"
BIN_DIR="$HOME/.local/bin"
REPO="https://github.com/loondx/signal-hunter.git"
BRANCH="main"
MIN_NODE=20

# ── Colours ───────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
    CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; DIM=''; RESET=''
fi

ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
die()  { echo -e "\n  ${RED}✗  $*${RESET}\n" >&2; exit 1; }
hr()   { echo -e "  ${DIM}────────────────────────────────────────────────────${RESET}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
cat << 'BANNER'
   _____ _                   _ _   _             _
  / ____(_)                 | | | | |           | |
 | (___  _  __ _ _ __   __ _| | |_| |_   _ _ __ | |_ ___ _ __
  \___ \| |/ _` | '_ \ / _` | |  _| | | | | '_ \| __/ _ \ '__|
  ____) | | (_| | | | | (_| | | | | | |_| | | | | ||  __/ |
 |_____/|_|\__, |_| |_|\__,_|_|_| |_|\__,_|_| |_|\__\___|_|
            __/ |
           |___/
BANNER
echo -e "${RESET}"
echo -e "  ${BOLD}AI agent that hunts buying signals for your business${RESET}"
echo -e "  ${DIM}github.com/loondx/signal-hunter${RESET}"
echo ""
hr
echo ""

# ── Node.js check / install ───────────────────────────────────────────────────
node_version() {
    node -e 'process.stdout.write(String(parseInt(process.version.slice(1))))' 2>/dev/null || echo "0"
}

if command -v node &>/dev/null && [ "$(node_version)" -ge "$MIN_NODE" ]; then
    ok "Node.js $(node --version)"
else
    warn "Node.js ${MIN_NODE}+ not found"
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        info "Installing Node.js via nvm..."
        # shellcheck disable=SC1090
        source "$HOME/.nvm/nvm.sh"
        nvm install "$MIN_NODE" --lts --no-progress 2>/dev/null
        nvm use "$MIN_NODE" --silent
        nvm alias default "$MIN_NODE" --silent
        ok "Node.js $(node --version) installed via nvm"
    elif command -v brew &>/dev/null; then
        info "Installing Node.js via Homebrew..."
        brew install node@${MIN_NODE} --quiet
        ok "Node.js $(node --version) installed"
    else
        die "Node.js ${MIN_NODE}+ is required.\n\n  Install it first:\n    https://nodejs.org  (direct)\n    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash  (nvm)"
    fi
fi

# ── git check ─────────────────────────────────────────────────────────────────
command -v git &>/dev/null || die "git is required.\n  Install it: sudo apt install git  or  brew install git"
ok "git $(git --version | awk '{print $3}')"

# ── Install / update ──────────────────────────────────────────────────────────
echo ""
if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing install at ${CYAN}${INSTALL_DIR}${RESET}..."
    git -C "$INSTALL_DIR" fetch --quiet
    git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH" --quiet
    ok "Updated to latest"
else
    info "Installing to ${CYAN}${INSTALL_DIR}${RESET}..."
    git clone --depth 1 --branch "$BRANCH" "$REPO" "$INSTALL_DIR" --quiet
    ok "Source code cloned"
fi

# ── Dependencies ──────────────────────────────────────────────────────────────
info "Installing dependencies..."
npm install --prefix "$INSTALL_DIR" --omit=dev --silent
ok "Dependencies installed"

# ── Create wrapper binary ─────────────────────────────────────────────────────
mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/signal-hunter" << WRAPPER
#!/usr/bin/env bash
export SIGNAL_HUNTER_HOME="\${SIGNAL_HUNTER_HOME:-${INSTALL_DIR}}"
exec node "\$SIGNAL_HUNTER_HOME/bin/cli.js" "\$@"
WRAPPER
chmod +x "$BIN_DIR/signal-hunter"
ok "CLI command created at ${CYAN}${BIN_DIR}/signal-hunter${RESET}"

# ── PATH setup ────────────────────────────────────────────────────────────────
PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'
PATH_ADDED=false

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
        if [ -f "$rc" ] && ! grep -q '.local/bin' "$rc" 2>/dev/null; then
            { echo ""; echo "# Signal Hunter"; echo "$PATH_LINE"; } >> "$rc"
            PATH_ADDED=true
        fi
    done
    export PATH="$BIN_DIR:$PATH"
fi

if $PATH_ADDED; then
    warn "Added ~/.local/bin to PATH in your shell config"
    warn "Restart your terminal or run: ${CYAN}source ~/.bashrc${RESET}"
else
    ok "PATH is already configured"
fi

# ── Copy example configs to workspace ────────────────────────────────────────
mkdir -p "$INSTALL_DIR/config" "$INSTALL_DIR/data" "$INSTALL_DIR/logs"
for f in businesses sources; do
    dest="$INSTALL_DIR/config/$f.yml"
    src="$INSTALL_DIR/config/$f.example.yml"
    [ ! -f "$dest" ] && [ -f "$src" ] && cp "$src" "$dest"
done

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
hr
echo ""
echo -e "  ${GREEN}${BOLD}✓  Signal Hunter installed!${RESET}"
echo ""
echo -e "  Installed to: ${DIM}${INSTALL_DIR}${RESET}"
echo -e "  Your data:    ${DIM}${INSTALL_DIR}/config/${RESET}  ${DIM}${INSTALL_DIR}/data/${RESET}"
echo ""
echo -e "  ${BOLD}Next step — run the setup wizard:${RESET}"
echo ""
echo -e "    ${CYAN}${BOLD}signal-hunter setup${RESET}"
echo ""
echo -e "  ${DIM}Other commands:  signal-hunter doctor  |  signal-hunter scan  |  signal-hunter --help${RESET}"
echo ""
hr
echo ""
