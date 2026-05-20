/**
 * Central path resolver for Signal Hunter.
 *
 * PKG_DIR  — where the source code lives (the npm package / cloned repo)
 * DATA_DIR — where user data lives (config, signals, logs, .env)
 *
 * Two install modes are supported automatically:
 *
 *   curl | bash  → clones to ~/.signal-hunter/
 *                  PKG_DIR = DATA_DIR = ~/.signal-hunter/
 *
 *   npm install -g signal-hunter  → code inside node_modules
 *                  PKG_DIR  = /usr/lib/node_modules/signal-hunter/
 *                  DATA_DIR = ~/.signal-hunter/  (auto-detected)
 *
 * Override: SIGNAL_HUNTER_HOME=/custom/path signal-hunter scan
 */

import { homedir }         from 'os';
import { join, dirname }   from 'path';
import { fileURLToPath }   from 'url';

// Absolute path to the package source code
export const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

// User data directory — platform-aware defaults:
//   Windows  : %APPDATA%\signal-hunter
//   Mac/Linux: ~/.signal-hunter
// Override with SIGNAL_HUNTER_HOME env var.
const inNodeModules = PKG_DIR.includes('node_modules');

function defaultDataDir() {
    if (process.platform === 'win32') {
        return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'signal-hunter');
    }
    return join(homedir(), '.signal-hunter');
}

export const DATA_DIR =
    process.env.SIGNAL_HUNTER_HOME ||
    (inNodeModules ? defaultDataDir() : PKG_DIR);
