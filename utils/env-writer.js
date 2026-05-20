// Atomic .env key upsert — used by OAuth2 flows to persist tokens.
// Reads the existing .env, updates or appends the key, writes atomically.

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from './paths.js';

const ENV_PATH = join(DATA_DIR, '.env');

export function readEnvFile() {
    if (!existsSync(ENV_PATH)) return [];
    return readFileSync(ENV_PATH, 'utf8').split('\n');
}

export function appendEnvKey(key, value) {
    const lines = readEnvFile();
    const idx   = lines.findIndex(l => l.startsWith(`${key}=`) || l.startsWith(`${key} =`));
    if (idx >= 0) {
        lines[idx] = `${key}=${value}`;
    } else {
        lines.push(`${key}=${value}`);
    }
    const content = lines.join('\n');
    const tmp = `${ENV_PATH}.tmp`;
    writeFileSync(tmp, content, 'utf8');
    renameSync(tmp, ENV_PATH);
    // Also update current process env
    process.env[key] = value;
}
