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

# Remove binaries from known bin locations (incl. the `loondx` alias)
for dir in "${BIN_DIRS[@]}"; do
    for bin in signal-hunter loondx; do
        if [ -f "$dir/$bin" ] || [ -L "$dir/$bin" ]; then
            rm -f "$dir/$bin"
            printf "  ✓  Removed %s/%s\n" "$dir" "$bin"
        fi
    done
done

printf "\n  Signal Hunter removed.\n"
printf "  You may also want to clean up any PATH lines from ~/.bashrc or ~/.zshrc.\n\n"
