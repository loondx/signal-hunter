#!/usr/bin/env bash
# Signal Hunter — Uninstaller
# Usage: bash ~/.signal-hunter/uninstall.sh
set -euo pipefail

INSTALL_DIR="${SIGNAL_HUNTER_HOME:-$HOME/.signal-hunter}"
BIN_FILE="$HOME/.local/bin/signal-hunter"

echo ""
echo "  Signal Hunter — Uninstall"
echo ""

read -rp "  Remove Signal Hunter? Your data (config, signals) will also be deleted. [y/N] " confirm
[[ "${confirm,,}" == "y" ]] || { echo "  Cancelled."; exit 0; }

# Stop daemon if running
if [ -f "$INSTALL_DIR/data/cron.pid" ]; then
    pid=$(cat "$INSTALL_DIR/data/cron.pid")
    kill "$pid" 2>/dev/null && echo "  ✓  Stopped daemon (PID $pid)"
fi

# Remove install dir
[ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR" && echo "  ✓  Removed $INSTALL_DIR"

# Remove binary
[ -f "$BIN_FILE" ] && rm -f "$BIN_FILE" && echo "  ✓  Removed $BIN_FILE"

echo ""
echo "  Signal Hunter has been removed."
echo "  You may also want to remove the PATH line from ~/.bashrc or ~/.zshrc."
echo ""
