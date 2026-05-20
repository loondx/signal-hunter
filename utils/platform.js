// Cross-platform utilities — one place for all OS-specific behaviour.
// Import from here instead of sprinkling process.platform checks everywhere.

import { execSync } from 'child_process';
import { join }     from 'path';
import { homedir }  from 'os';

export const IS_WIN   = process.platform === 'win32';
export const IS_MAC   = process.platform === 'darwin';
export const IS_LINUX = !IS_WIN && !IS_MAC;

// ── Browser ───────────────────────────────────────────────────────────────────
export function openBrowser(url) {
    const cmd = IS_WIN  ? `start "" "${url}"` :
                IS_MAC  ? `open "${url}"`      : `xdg-open "${url}"`;
    try { execSync(cmd, { stdio: 'ignore' }); } catch {}
}

// ── Process management ────────────────────────────────────────────────────────

/** Returns true if PID is alive. Works on all platforms (signal 0 = probe only). */
export function isRunning(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
}

/**
 * Terminate a process gracefully, then forcefully if needed.
 * On Windows: uses `taskkill` because SIGTERM is not supported.
 * On Unix: sends SIGTERM then SIGKILL.
 */
export function killProcess(pid, force = false) {
    if (IS_WIN) {
        try {
            execSync(`taskkill${force ? ' /F' : ''} /PID ${pid}`, { stdio: 'ignore' });
            return true;
        } catch { return false; }
    }
    try {
        process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
        return true;
    } catch { return false; }
}

// ── Paths ─────────────────────────────────────────────────────────────────────

/** Default user data directory for signal-hunter, consistent across OSes. */
export function defaultDataDir() {
    // Windows: %APPDATA%\signal-hunter  or  %USERPROFILE%\.signal-hunter
    // Mac/Linux: ~/.signal-hunter
    return IS_WIN
        ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'signal-hunter')
        : join(homedir(), '.signal-hunter');
}

/** Directory where the `signal-hunter` binary/script should be placed. */
export function defaultBinDir() {
    // Windows: %APPDATA%\signal-hunter\bin  (added to PATH by installer)
    // Mac/Linux: ~/.local/bin
    return IS_WIN
        ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'signal-hunter', 'bin')
        : join(homedir(), '.local', 'bin');
}

// ── Node executable ───────────────────────────────────────────────────────────

/** Node.js executable name — 'node' on all platforms (Windows adds .exe automatically). */
export const NODE_EXE = 'node';

// ── Shell detection ───────────────────────────────────────────────────────────
export function shellHint() {
    if (IS_WIN) return 'PowerShell or Command Prompt';
    if (IS_MAC) return 'zsh or bash';
    return 'bash';
}
