#!/usr/bin/env node
// Signal Hunter — Background Scan Daemon
// Runs on a schedule using node-cron.
// Spawns `node scan.mjs` as a child process each tick so scan output
// is isolated and a crashed scan never kills the daemon.
//
// Usage (direct):
//   node cron-daemon.mjs --interval 30m
//
// Usage (via CLI):
//   signal-hunter cron start --interval 30m
//   signal-hunter cron start --interval 1h  --foreground

import cron          from 'node-cron';
import { spawn }     from 'child_process';
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv }   from './utils/config.js';
import { logger }    from './utils/logger.js';

loadEnv();

const ROOT    = dirname(fileURLToPath(import.meta.url));
const PID_FILE = join(ROOT, 'data/cron.pid');

// ── Arg helpers ───────────────────────────────────────────────────────────────
function argValue(args, flag) {
    const idx = args.indexOf(flag);
    if (idx >= 0 && args[idx + 1]) return args[idx + 1];
    const prefixed = args.find(a => a.startsWith(flag + '='));
    return prefixed ? prefixed.split('=').slice(1).join('=') : null;
}

// ── Interval → cron expression ────────────────────────────────────────────────
function toCronExpr(interval) {
    const mins  = interval.match(/^(\d+)m$/);  if (mins)  return `*/${mins[1]} * * * *`;
    const hours = interval.match(/^(\d+)h$/);  if (hours) return `0 */${hours[1]} * * *`;
    const days  = interval.match(/^(\d+)d$/);  if (days)  return `0 0 */${days[1]} * *`;
    // If it looks like a cron expression already, use it directly
    if (interval.split(' ').length >= 5) return interval;
    return '*/30 * * * *'; // default: every 30 minutes
}

// ── Spawn a scan child process ────────────────────────────────────────────────
function spawnScan() {
    return new Promise((resolve) => {
        logger.info('Cron: spawning scan...');
        const child = spawn('node', [join(ROOT, 'scan.mjs')], {
            cwd:   ROOT,
            stdio: 'inherit',
        });
        child.on('exit', (code) => {
            logger.info(`Cron: scan exited with code ${code ?? 0}`);
            resolve(code ?? 0);
        });
        child.on('error', (err) => {
            logger.error(`Cron: scan spawn error: ${err.message}`);
            resolve(1);
        });
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const interval = argValue(args, '--interval') || '30m';
const cronExpr = toCronExpr(interval.trim());

if (!cron.validate(cronExpr)) {
    console.error(`Invalid interval "${interval}" (cron: "${cronExpr}")`);
    process.exit(1);
}

// Write PID file so `signal-hunter cron stop` can find us
mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(PID_FILE, String(process.pid));

logger.info(`Cron daemon started. PID: ${process.pid}. Schedule: every ${interval} (${cronExpr})`);
console.log(`\n  Signal Hunter daemon running (every ${interval})`);
console.log(`  PID: ${process.pid}  |  PID file: data/cron.pid`);
console.log(`  Stop with: signal-hunter cron stop\n`);

// Graceful shutdown
let stopping = false;
function shutdown() {
    if (stopping) return;
    stopping = true;
    logger.info('Cron daemon shutting down.');
    try { if (existsSync(PID_FILE)) unlinkSync(PID_FILE); } catch {}
    process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

// Run one scan immediately on start, then on schedule
await spawnScan();
cron.schedule(cronExpr, spawnScan);
