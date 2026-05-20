import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs';
import { join }  from 'path';
import { DATA_DIR } from './paths.js';
import { normalizeUrl, normalizeAllUrls } from './url-normalize.js';

const DATA  = join(DATA_DIR, 'data');
const SIGS  = join(DATA, 'signals.json');
const SEEN  = join(DATA, 'seen-ids.json');

function ensureDataDir() {
    mkdirSync(DATA, { recursive: true });
}

// Atomic write — write to .tmp then rename to prevent half-written files on crash.
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
    const arr     = [...ids];
    const bounded = arr.length > 10_000 ? arr.slice(-10_000) : arr;
    atomicWrite(SEEN, JSON.stringify(bounded));
}

// ── Signal pipeline ───────────────────────────────────────────────────────────

export function loadSignals() {
    ensureDataDir();
    if (!existsSync(SIGS)) return [];
    try {
        const raw = JSON.parse(readFileSync(SIGS, 'utf8'));
        // Always normalize URLs on load — fixes old.reddit.com from pre-v0.2 signals
        return normalizeAllUrls(raw);
    } catch { return []; }
}

export function appendSignal(signal) {
    const existing = loadSignals();
    const entry = {
        num:      existing.length + 1,
        ...signal,
        url:      normalizeUrl(signal.url),  // normalize before storing
        status:   'new',
        saved_at: new Date().toISOString(),
    };
    atomicWrite(SIGS, JSON.stringify([...existing, entry], null, 2));
    return entry;
}

/** One-time migration: rewrite signals.json with normalized URLs. */
export function migrateSignalUrls() {
    ensureDataDir();
    if (!existsSync(SIGS)) return 0;
    try {
        const raw       = JSON.parse(readFileSync(SIGS, 'utf8'));
        const fixed     = normalizeAllUrls(raw);
        const changed   = fixed.filter((s, i) => s.url !== raw[i]?.url).length;
        if (changed > 0) atomicWrite(SIGS, JSON.stringify(fixed, null, 2));
        return changed;
    } catch { return 0; }
}
