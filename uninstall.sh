#!/usr/bin/env bash
# Signal Hunter — Uninstaller (macOS / Linux)
# Usage: bash ~/.signal-hunter/uninstall.sh
#
# Windows: see uninstall instructions in README or run uninstall.ps1

set -euo pipefail

INSTALL_DIR="${SIGNAL_HUNTER_HOME:-$HOME/.signal-hunter}"
BIN_DIRS=("$HOME/.local/bin" "$HOME/bin" "/usr/local/bin")

printf "\n  Signal Hunter — Uninstall\n\n"

read -rp "  Remove Signal Hunter? Config and signals will also be deleted. [y/N] " confirm
[[ "${confirm,,}" == "y" ]] || { printf "  Cancelled.\n"; exit 0; }

# Stop daemon if running
PID_FILE="$INSTALL_DIR/data/cron.pid"
if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null && printf "  ✓  Stopped daemon (PID %s)\n" "$pid"
    fi
fi

# Remove install directory
if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    printf "  ✓  Removed %s\n" "$INSTALL_DIR"
fi

# Remove binary from known bin locations
for dir in "${BIN_DIRS[@]}"; do
    if [ -f "$dir/signal-hunter" ]; then
        rm -f "$dir/signal-hunter"
        printf "  ✓  Removed %s/signal-hunter\n" "$dir"
    fi
done

printf "\n  Signal Hunter removed.\n"
printf "  You may also want to clean up any PATH lines from ~/.bashrc or ~/.zshrc.\n\n"
