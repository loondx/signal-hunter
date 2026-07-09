#!/usr/bin/env node
// Signal Hunter — Background Scan Daemon
// Spawns `node src/commands/scan.js` as a child process each tick.
// A crashed scan never kills the daemon.

import cron      from 'node-cron';
import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join }  from 'path';
import { loadEnv }  from '../utils/config.js';
import { logger }   from '../utils/logger.js';
import { PKG_DIR, DATA_DIR } from '../utils/paths.js';
import { argValue } from '../utils/args.js';
import { IS_WIN }   from '../utils/platform.js';

loadEnv();

const PID_FILE = join(DATA_DIR, 'data/cron.pid');

function toCronExpr(interval) {
    const mins  = interval.match(/^(\d+)m$/);  if (mins)  return `*/${mins[1]} * * * *`;
    const hours = interval.match(/^(\d+)h$/);  if (hours) return `0 */${hours[1]} * * *`;
    const days  = interval.match(/^(\d+)d$/);  if (days)  return `0 0 */${days[1]} * *`;
    if (interval.split(' ').length >= 5) return interval;
    return '*/30 * * * *';
}

let scanRunning   = false;
let failureStreak = 0;

async function runScan() {
    // Overlap guard: if a scan outlives the interval, skip this tick instead
    // of stacking a second scan on top of it.
    if (scanRunning) {
        logger.warn('Cron: previous scan still running — skipping this tick');
        return;
    }
    scanRunning = true;
    try {
        const code = await spawnScan();
        if (code === 0) {
            failureStreak = 0;
        } else if (++failureStreak >= 3) {
            logger.error(`Cron: ${failureStreak} scans failed in a row — check \`signal-hunter doctor\` and ${join(DATA_DIR, 'logs')}`);
        }
    } finally {
        scanRunning = false;
    }
}

function spawnScan() {
    return new Promise((resolve) => {
        logger.info('Cron: spawning scan...');
        const child = spawn('node', [join(PKG_DIR, 'src/commands/scan.js')], {
            cwd:   PKG_DIR,
            stdio: 'inherit',
            env:   { ...process.env },
        });
        child.on('exit',  (code) => { logger.info(`Cron: scan exited ${code ?? 0}`); resolve(code ?? 0); });
        child.on('error', (err)  => { logger.error(`Cron: spawn error: ${err.message}`); resolve(1); });
    });
}

// The loop must never die silently: log and keep ticking.
process.on('uncaughtException',  (err) => logger.error(`Cron: uncaught exception: ${err.stack || err.message}`));
process.on('unhandledRejection', (err) => logger.error(`Cron: unhandled rejection: ${err?.stack || err}`));

const args     = process.argv.slice(2);
const interval = argValue(args, '--interval') || '30m';
const cronExpr = toCronExpr(interval.trim());

if (!cron.validate(cronExpr)) {
    console.error(`Invalid interval "${interval}" (cron: "${cronExpr}")`);
    process.exit(1);
}

mkdirSync(join(DATA_DIR, 'data'), { recursive: true });
writeFileSync(PID_FILE, String(process.pid));

logger.info(`Cron daemon started. PID: ${process.pid}. Schedule: every ${interval} (${cronExpr})`);
console.log(`\n  Signal Hunter daemon running (every ${interval})`);
console.log(`  PID: ${process.pid}  |  data: ${DATA_DIR}`);
console.log(`  Stop: signal-hunter cron stop\n`);

let stopping = false;
function shutdown() {
    if (stopping) return;
    stopping = true;
    logger.info('Cron daemon shutting down.');
    try { if (existsSync(PID_FILE)) unlinkSync(PID_FILE); } catch {}
    process.exit(0);
}
process.on('SIGINT',  shutdown); // Ctrl+C — all platforms
if (!IS_WIN) {
    process.on('SIGTERM', shutdown); // graceful stop on Unix (not available on Windows)
} else {
    process.on('SIGBREAK', shutdown); // Windows Ctrl+Break equivalent
}

await runScan();
cron.schedule(cronExpr, runScan);
