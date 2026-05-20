import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs';
import { join }  from 'path';
import { DATA_DIR } from './paths.js';

const DATA  = join(DATA_DIR, 'data');
const SIGS  = join(DATA, 'signals.json');
const SEEN  = join(DATA, 'seen-ids.json');

function ensureDataDir() {
    mkdirSync(DATA, { recursive: true });
}

// Atomic write — write to .tmp then rename to prevent half-written files on crash.
// Rename is atomic on the same filesystem (POSIX rename(2) guarantee).
function atomicWrite(path, data) {
    const tmp = `${path}.tmp`;
    try {
        writeFileSync(tmp, data, 'utf8');
        renameSync(tmp, path);
    } catch (err) {
        try { unlinkSync(tmp); } catch {}
        throw err;
    }
}

// ── First-run detection ───────────────────────────────────────────────────────

// True only when seen-ids.json doesn't exist yet (fresh install or fresh data dir).
// Used by scan.js to build a baseline instead of flooding notifications.
export function isFirstRun() {
    return !existsSync(SEEN);
}

// ── Seen IDs ──────────────────────────────────────────────────────────────────

export function loadSeenIds() {
    ensureDataDir();
    if (!existsSync(SEEN)) return new Set();
    try { return new Set(JSON.parse(readFileSync(SEEN, 'utf8'))); } catch { return new Set(); }
}

export function saveSeenIds(ids) {
    ensureDataDir();
    // Bound to 10k entries — prevents unbounded growth over months of scanning.
    // Oldest IDs drop off first, which is fine: they're from old posts.
    const arr = [...ids];
    const bounded = arr.length > 10_000 ? arr.slice(-10_000) : arr;
    atomicWrite(SEEN, JSON.stringify(bounded));
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
    atomicWrite(SIGS, JSON.stringify([...existing, entry], null, 2));
    return entry;
}
