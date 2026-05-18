#!/usr/bin/env node
// signal-hunter cron <start|stop|status|logs|install> [options]
import { spawn }                                              from 'child_process';
import { existsSync, readFileSync, unlinkSync, mkdirSync, openSync } from 'fs';
import { join }                                               from 'path';
import pc                                                     from 'picocolors';
import { loadEnv }                                            from './utils/config.js';
import { PKG_DIR, DATA_DIR }                                  from './utils/paths.js';

loadEnv();

const PID_FILE = join(DATA_DIR, 'data/cron.pid');

function argValue(args, flag) {
    const idx = args.indexOf(flag);
    if (idx >= 0 && args[idx + 1]) return args[idx + 1];
    const prefixed = args.find(a => a.startsWith(flag + '='));
    return prefixed ? prefixed.split('=').slice(1).join('=') : null;
}

function isRunning(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
}

function readPid() {
    if (!existsSync(PID_FILE)) return null;
    const pid = parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10);
    return isNaN(pid) ? null : pid;
}

// ── Commands ──────────────────────────────────────────────────────────────────

function cmdStart(args) {
    const interval   = argValue(args, '--interval') || '30m';
    const foreground = args.includes('--foreground');

    const existingPid = readPid();
    if (existingPid && isRunning(existingPid)) {
        console.log(`\n  ${pc.yellow('⚠')}  Daemon already running (PID ${existingPid})`);
        console.log(`  Stop it first: ${pc.cyan('signal-hunter cron stop')}\n`);
        process.exit(1);
    }

    if (foreground) {
        console.log(`\n  Starting in foreground (every ${interval}). Press Ctrl+C to stop.\n`);
        const child = spawn('node', [join(PKG_DIR, 'cron-daemon.mjs'), '--interval', interval], {
            cwd: PKG_DIR, stdio: 'inherit',
        });
        child.on('exit', code => process.exit(code ?? 0));
        return;
    }

    // Background mode — detached process, logs to file
    mkdirSync(join(DATA_DIR, 'logs'), { recursive: true });
    const logFd = openSync(join(DATA_DIR, 'logs/cron.log'), 'a');
    const child = spawn('node', [join(PKG_DIR, 'cron-daemon.mjs'), '--interval', interval], {
        cwd: PKG_DIR, stdio: ['ignore', logFd, logFd], detached: true,
    });
    child.unref();

    // Brief wait for PID file to be written by daemon
    setTimeout(() => {
        const pid = readPid();
        if (pid && isRunning(pid)) {
            console.log(`\n  ${pc.green('✓')}  Daemon started (PID ${pid}, every ${interval})`);
            console.log(`  Logs: ${pc.dim('logs/cron.log')}`);
            console.log(`  Stop: ${pc.cyan('signal-hunter cron stop')}\n`);
        } else {
            console.log(`\n  ${pc.red('✗')}  Daemon failed to start — check logs/cron.log\n`);
        }
    }, 1500);
}

function cmdStop() {
    const pid = readPid();
    if (!pid) {
        console.log(`\n  ${pc.dim('No daemon PID file found — not running.')}\n`);
        return;
    }
    if (!isRunning(pid)) {
        try { unlinkSync(PID_FILE); } catch {}
        console.log(`\n  ${pc.dim(`PID ${pid} is not running (stale PID file removed).`)}\n`);
        return;
    }
    try {
        process.kill(pid, 'SIGTERM');
        setTimeout(() => {
            if (isRunning(pid)) {
                process.kill(pid, 'SIGKILL');
                console.log(`\n  ${pc.yellow('!')}  PID ${pid} force-killed (SIGKILL)\n`);
            } else {
                console.log(`\n  ${pc.green('✓')}  Daemon stopped (PID ${pid})\n`);
            }
            try { unlinkSync(PID_FILE); } catch {}
        }, 1000);
    } catch (err) {
        console.log(`\n  ${pc.red('✗')}  Failed to stop PID ${pid}: ${err.message}\n`);
    }
}

function cmdStatus() {
    const pid = readPid();
    console.log('');
    if (!pid) {
        console.log(`  ${pc.dim('●')}  Daemon is ${pc.dim('not running')}`);
    } else if (isRunning(pid)) {
        console.log(`  ${pc.green('●')}  Daemon is ${pc.green('running')}  (PID ${pid})`);
        console.log(`  Logs: ${pc.cyan('signal-hunter cron logs')}`);
        console.log(`  Stop: ${pc.cyan('signal-hunter cron stop')}`);
    } else {
        console.log(`  ${pc.yellow('●')}  Stale PID file (PID ${pid} not running)`);
        console.log(`  Run ${pc.cyan('signal-hunter cron start')} to restart`);
    }
    console.log('');
}

function cmdLogs() {
    const logFile = join(DATA_DIR, 'logs/cron.log');
    if (!existsSync(logFile)) {
        console.log('\n  No log file yet — daemon has not run.\n');
        return;
    }
    const lines  = readFileSync(logFile, 'utf8').split('\n');
    const last50 = lines.slice(-51).join('\n');
    console.log(last50);
}

function cmdInstall(args) {
    const interval = argValue(args, '--interval') || '30m';
    const absPath  = DATA_DIR;

    const mins  = interval.match(/^(\d+)m$/);
    const hours = interval.match(/^(\d+)h$/);
    const cronExpr = mins  ? `*/${mins[1]} * * * *` :
                     hours ? `0 */${hours[1]} * * *` : '*/30 * * * *';

    console.log(`
${pc.bold('  Choose your automation method:')}

  ${pc.bold(pc.cyan('1. Crontab'))} (simplest — works on any Linux/macOS)
  ───────────────────────────────────────────
  Run ${pc.cyan('crontab -e')} and add:

  ${pc.green(`${cronExpr} cd ${absPath} && node scan.mjs >> logs/cron.log 2>&1`)}

  ${pc.bold(pc.cyan('2. PM2'))} ${pc.dim('(recommended for VPS — auto-restarts on crash)')}
  ───────────────────────────────────────────
  ${pc.green(`npm install -g pm2`)}
  ${pc.green(`pm2 start ${absPath}/cron-daemon.mjs --name signal-hunter -- --interval ${interval}`)}
  ${pc.green(`pm2 save && pm2 startup`)}

  ${pc.bold(pc.cyan('3. Built-in daemon'))} ${pc.dim('(background process, lost on reboot)')}
  ───────────────────────────────────────────
  ${pc.green(`signal-hunter cron start --interval ${interval}`)}

  ${pc.bold(pc.cyan('4. Systemd'))} ${pc.dim('(production Linux — survives reboots)')}
  ───────────────────────────────────────────
  Save to ${pc.dim('/etc/systemd/system/signal-hunter.service')}:

${pc.dim(`  [Unit]
  Description=Signal Hunter — AI lead scanner
  After=network.target

  [Service]
  Type=simple
  User=${process.env.USER || 'ubuntu'}
  WorkingDirectory=${absPath}
  ExecStart=/usr/bin/node ${absPath}/cron-daemon.mjs --interval ${interval}
  Restart=on-failure
  RestartSec=10

  [Install]
  WantedBy=multi-user.target`)}

  Then run: ${pc.green('sudo systemctl enable --now signal-hunter')}
`);
}

// ── Route subcommand ──────────────────────────────────────────────────────────
// When called via CLI:    process.argv = [node, cron.mjs, 'cron', 'start', ...]
// When called directly:   process.argv = [node, cron.mjs, 'start', ...]
const rawArgs = process.argv.slice(2);
const args    = rawArgs[0] === 'cron' ? rawArgs.slice(1) : rawArgs;
const subcmd  = args[0];
const rest    = args.slice(1);

switch (subcmd) {
    case 'start':   cmdStart(rest);   break;
    case 'stop':    cmdStop();        break;
    case 'status':  cmdStatus();      break;
    case 'logs':    cmdLogs();        break;
    case 'install': cmdInstall(rest); break;
    default:
        console.log(`
  ${pc.bold('signal-hunter cron')} — built-in scheduler

  ${pc.bold('Commands:')}
    ${pc.cyan('cron start')}                    Start background daemon (every 30m)
    ${pc.cyan('cron start --interval 1h')}      Custom interval: 30m, 1h, 6h, 1d
    ${pc.cyan('cron start --foreground')}       Foreground mode (for systemd/Docker)
    ${pc.cyan('cron stop')}                     Stop the daemon
    ${pc.cyan('cron status')}                   Show if daemon is running
    ${pc.cyan('cron logs')}                     Tail last 50 log lines
    ${pc.cyan('cron install')}                  Print crontab/PM2/systemd configs
`);
}
