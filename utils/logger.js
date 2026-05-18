import { appendFile, mkdir } from 'fs/promises';
import { existsSync }        from 'fs';
import { join }              from 'path';
import pc                    from 'picocolors';
import { DATA_DIR }          from './paths.js';

const LOG_DIR  = join(DATA_DIR, 'logs');
const LOG_FILE = join(LOG_DIR, 'app.log');

async function ensureLogDir() {
    if (!existsSync(LOG_DIR)) await mkdir(LOG_DIR, { recursive: true });
}

async function write(level, message) {
    const ts   = new Date().toISOString();
    const text = typeof message === 'object' ? JSON.stringify(message) : String(message);
    const line = `[${ts}] [${level}] ${text}\n`;

    const colored = {
        INFO:  pc.cyan(`[INFO]  ${text}`),
        WARN:  pc.yellow(`[WARN]  ${text}`),
        ERROR: pc.red(`[ERROR] ${text}`),
        DEBUG: pc.dim(`[DEBUG] ${text}`),
    }[level] ?? text;

    if (level === 'ERROR') console.error(colored);
    else if (level !== 'DEBUG') console.log(colored);

    await ensureLogDir();
    await appendFile(LOG_FILE, line).catch(() => {});
}

export const logger = {
    info:  (msg) => write('INFO',  msg),
    warn:  (msg) => write('WARN',  msg),
    error: (msg) => write('ERROR', msg),
    debug: (msg) => write('DEBUG', msg),
};
