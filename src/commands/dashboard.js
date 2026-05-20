#!/usr/bin/env node
// signal-hunter dashboard — local web dashboard on http://localhost:3000
// Works on Windows, macOS, Linux. Open from phone on same WiFi too.
//
// Usage:
//   signal-hunter dashboard              # opens on port 3000
//   signal-hunter dashboard --port 3001  # custom port
//   signal-hunter dashboard --no-open    # don't auto-open browser

import { createServer }                             from 'http';
import { existsSync, readFileSync, writeFileSync,
         renameSync, statSync }                     from 'fs';
import { join, extname }                            from 'path';
import { networkInterfaces }                        from 'os';
import { spawn }                                    from 'child_process';
import pc                                           from 'picocolors';
import { loadEnv, loadProfile }                     from '../../utils/config.js';
import { loadSignals }                              from '../../utils/store.js';
import { DATA_DIR, PKG_DIR }                        from '../../utils/paths.js';
import { argValue }                                 from '../../utils/args.js';
import { openBrowser }                              from '../../utils/platform.js';

loadEnv();

const rawArgs   = process.argv.slice(2);
const PORT      = parseInt(argValue(rawArgs, '--port') || argValue(rawArgs, '-p') || '3000', 10);
const AUTO_OPEN = !rawArgs.includes('--no-open');
const DASH_HTML = join(PKG_DIR, 'dashboard', 'index.html');
const SIGS_PATH = join(DATA_DIR, 'data', 'signals.json');

// ── Scan state ────────────────────────────────────────────────────────────────
let scanRunning = false;
const scanLog   = [];

function triggerScan() {
    if (scanRunning) return { ok: false, reason: 'Already running' };
    scanRunning = true;
    scanLog.length = 0;
    const child = spawn('node', [join(PKG_DIR, 'src/commands/scan.js')], {
        cwd: PKG_DIR, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', d => { scanLog.push(d.toString()); if (scanLog.length > 200) scanLog.shift(); });
    child.stderr.on('data', d => { scanLog.push(d.toString()); if (scanLog.length > 200) scanLog.shift(); });
    child.on('exit', () => { scanRunning = false; });
    return { ok: true };
}

// ── Data helpers ──────────────────────────────────────────────────────────────
function computeStats(signals) {
    const bySource = {};
    const status   = { new: 0, replied: 0, skipped: 0 };
    const buckets  = { hot: 0, warm: 0, ok: 0, cold: 0 };

    for (const s of signals) {
        status[s.status] = (status[s.status] || 0) + 1;
        if      (s.score >= 80) buckets.hot++;
        else if (s.score >= 65) buckets.warm++;
        else if (s.score >= 50) buckets.ok++;
        else                    buckets.cold++;

        const src = s.source || 'unknown';
        if (!bySource[src]) bySource[src] = { total: 0, replied: 0, skipped: 0, scoreSum: 0 };
        bySource[src].total++;
        bySource[src].scoreSum += s.score || 0;
        if (s.status === 'replied') bySource[src].replied++;
        if (s.status === 'skipped') bySource[src].skipped++;
    }

    const sources = Object.entries(bySource)
        .sort(([, a], [, b]) => b.replied - a.replied || b.total - a.total)
        .map(([src, s]) => ({
            source:   src,
            total:    s.total,
            replied:  s.replied,
            skipped:  s.skipped,
            rate:     s.total ? Math.round((s.replied / s.total) * 100) : 0,
            avgScore: s.total ? Math.round(s.scoreSum / s.total) : 0,
        }));

    return { status, buckets, sources };
}

function loadLearning() {
    const p = join(DATA_DIR, 'data', 'learning.json');
    if (!existsSync(p)) return null;
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function loadProfileSafe() {
    try {
        const p = loadProfile();
        return {
            name:          p?.identity?.name || '',
            type:          p?.identity?.type || 'freelancer',
            sources:       p?.sources?.enabled || [],
            min_score:     p?.llm?.min_score || 55,
            notify_score:  p?.notifications?.notify_min_score || 65,
            cron_interval: p?.automation?.cron_interval || '30m',
            llm:           p?.llm?.provider || 'gemini',
        };
    } catch { return null; }
}

function getLocalIp() {
    for (const ifaces of Object.values(networkInterfaces())) {
        for (const iface of (ifaces || [])) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return null;
}

// ── Request body reader ───────────────────────────────────────────────────────
function readBody(req) {
    return new Promise(resolve => {
        let data = '';
        req.on('data', c => { data += c; });
        req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    });
}

// ── Response helpers ──────────────────────────────────────────────────────────
function json(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    res.end(text);
}

function html(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
}

// ── Router ────────────────────────────────────────────────────────────────────
async function route(req, res) {
    const url    = new URL(req.url, `http://localhost`);
    const path   = url.pathname;
    const method = req.method;

    if (method === 'OPTIONS') { json(res, 200, {}); return; }

    // GET /api/data — everything the UI needs in one call
    if (path === '/api/data' && method === 'GET') {
        const signals  = loadSignals();
        const stats    = computeStats(signals);
        const learning = loadLearning();
        const profile  = loadProfileSafe();
        json(res, 200, { signals, stats, learning, profile, scanRunning, seenCount: signals.length });
        return;
    }

    // POST /api/scan
    if (path === '/api/scan' && method === 'POST') {
        json(res, 200, triggerScan());
        return;
    }

    // GET /api/scan/status
    if (path === '/api/scan/status' && method === 'GET') {
        json(res, 200, { running: scanRunning, log: scanLog.slice(-50).join('') });
        return;
    }

    // POST /api/signals/:num/:action
    const match = path.match(/^\/api\/signals\/(\d+)\/(reply|skip|open)$/);
    if (match && method === 'POST') {
        const num    = parseInt(match[1], 10);
        const action = match[2];

        const signals = loadSignals();
        const idx     = signals.findIndex(s => s.num === num);
        if (idx === -1) { json(res, 404, { ok: false }); return; }

        if (action === 'open') {
            if (signals[idx].url) openBrowser(signals[idx].url);
            json(res, 200, { ok: true });
            return;
        }

        const status = action === 'reply' ? 'replied' : 'skipped';
        signals[idx] = { ...signals[idx], status, updated_at: new Date().toISOString() };
        const tmp = SIGS_PATH + '.tmp';
        writeFileSync(tmp, JSON.stringify(signals, null, 2), 'utf8');
        renameSync(tmp, SIGS_PATH);

        try {
            const { recordFeedback } = await import('../../agents/learner.js');
            recordFeedback(signals[idx], action === 'reply' ? 'replied' : 'skipped');
        } catch {}

        json(res, 200, { ok: true, signal: signals[idx] });
        return;
    }

    // Static assets from dashboard/
    if (path !== '/' && path !== '/index.html') {
        const file = join(PKG_DIR, 'dashboard', path.slice(1));
        if (existsSync(file) && statSync(file).isFile()) {
            const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
            const body  = readFileSync(file);
            res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
            res.end(body);
            return;
        }
    }

    // SPA — serve dashboard/index.html
    if (!existsSync(DASH_HTML)) {
        html(res, 500, `<h2 style="font-family:sans-serif;padding:2rem">Dashboard HTML not found.<br><small>${DASH_HTML}</small></h2>`);
        return;
    }
    html(res, 200, readFileSync(DASH_HTML, 'utf8'));
}

// ── Start ─────────────────────────────────────────────────────────────────────
const server = createServer((req, res) => {
    route(req, res).catch(err => {
        console.error('Dashboard:', err.message);
        try { json(res, 500, { error: err.message }); } catch {}
    });
});

server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.error(pc.red(`\n  Port ${PORT} already in use.\n  Try: signal-hunter dashboard --port 3001\n`));
    } else {
        console.error(pc.red(`\n  ${err.message}\n`));
    }
    process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIp();
    console.log('');
    console.log('  ' + pc.bold(pc.cyan('Signal Hunter')) + pc.dim(' — Dashboard'));
    console.log('');
    console.log(`  ${pc.green('✓')}  Local   : ${pc.cyan(`http://localhost:${PORT}`)}`);
    if (ip) console.log(`  ${pc.green('✓')}  Network : ${pc.cyan(`http://${ip}:${PORT}`)}  ${pc.dim('← open on your phone')}`);
    console.log('');
    console.log(`  ${pc.dim('Ctrl+C to stop')}`);
    console.log('');
    if (AUTO_OPEN) setTimeout(() => openBrowser(`http://localhost:${PORT}`), 600);
});
