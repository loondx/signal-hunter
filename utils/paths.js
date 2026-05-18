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

// If the package is inside node_modules (global npm install), user data
// must live somewhere writable — default ~/.signal-hunter.
// If cloned directly (curl install), code and data share the same directory.
const inNodeModules = PKG_DIR.includes('node_modules');

export const DATA_DIR =
    process.env.SIGNAL_HUNTER_HOME ||
    (inNodeModules ? join(homedir(), '.signal-hunter') : PKG_DIR);
