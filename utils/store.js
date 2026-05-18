import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join }  from 'path';
import { DATA_DIR } from './paths.js';

const DATA  = join(DATA_DIR, 'data');
const SIGS  = join(DATA, 'signals.json');
const SEEN  = join(DATA, 'seen-ids.json');

function ensureDataDir() {
    mkdirSync(DATA, { recursive: true });
}

// ── Seen IDs ──────────────────────────────────────────────────────────────────

export function loadSeenIds() {
    ensureDataDir();
    if (!existsSync(SEEN)) return new Set();
    try { return new Set(JSON.parse(readFileSync(SEEN, 'utf8'))); } catch { return new Set(); }
}

export function saveSeenIds(ids) {
    ensureDataDir();
    writeFileSync(SEEN, JSON.stringify([...ids]));
}

// ── Signal pipeline ───────────────────────────────────────────────────────────

export function loadSignals() {
    ensureDataDir();
    if (!existsSync(SIGS)) return [];
    try { return JSON.parse(readFileSync(SIGS, 'utf8')); } catch { return []; }
}

export function appendSignal(signal) {
    const existing = loadSignals();
    const entry = {
        num:      existing.length + 1,
        ...signal,
        status:   'new',
        saved_at: new Date().toISOString(),
    };
    writeFileSync(SIGS, JSON.stringify([...existing, entry], null, 2));
    return entry;
}
