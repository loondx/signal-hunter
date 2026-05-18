import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const SIGNALS  = join(DATA_DIR, 'signals.json');
const SEEN     = join(DATA_DIR, 'seen-ids.json');

function ensureDataDir() {
    mkdirSync(DATA_DIR, { recursive: true });
}

// ── Seen IDs — prevents reprocessing already-fetched signals ─────────────────

export function loadSeenIds() {
    ensureDataDir();
    if (!existsSync(SEEN)) return new Set();
    try {
        return new Set(JSON.parse(readFileSync(SEEN, 'utf8')));
    } catch {
        return new Set();
    }
}

export function saveSeenIds(ids) {
    ensureDataDir();
    writeFileSync(SEEN, JSON.stringify([...ids]));
}

// ── Signal pipeline ───────────────────────────────────────────────────────────

export function loadSignals() {
    ensureDataDir();
    if (!existsSync(SIGNALS)) return [];
    try {
        return JSON.parse(readFileSync(SIGNALS, 'utf8'));
    } catch {
        return [];
    }
}

export function appendSignal(signal) {
    const existing = loadSignals();
    const entry = {
        num: existing.length + 1,
        ...signal,
        status: 'new',
        saved_at: new Date().toISOString(),
    };
    writeFileSync(SIGNALS, JSON.stringify([...existing, entry], null, 2));
    return entry;
}
