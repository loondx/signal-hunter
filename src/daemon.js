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

loadEnv();

const PID_FILE = join(DATA_DIR, 'data/cron.pid');

function toCronExpr(interval) {
    const mins  = interval.match(/^(\d+)m$/);  if (mins)  return `*/${mins[1]} * * * *`;
    const hours = interval.match(/^(\d+)h$/);  if (hours) return `0 */${hours[1]} * * *`;
    const days  = interval.match(/^(\d+)d$/);  if (days)  return `0 0 */${days[1]} * *`;
    if (interval.split(' ').length >= 5) return interval;
    return '*/30 * * * *';
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
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

await spawnScan();
cron.schedule(cronExpr, spawnScan);
