#!/usr/bin/env node
// signal-hunter cron <start|stop|status|logs|install> [options]
import { spawn }                                                     from 'child_process';
import { existsSync, readFileSync, unlinkSync, mkdirSync, openSync } from 'fs';
import { join }                                                      from 'path';
import pc                                                            from 'picocolors';
import { loadEnv, loadProfile }                                      from '../../utils/config.js';
import { PKG_DIR, DATA_DIR }                                         from '../../utils/paths.js';
import { argValue }                                                  from '../../utils/args.js';
import { IS_WIN, isRunning, killProcess }                            from '../../utils/platform.js';

loadEnv();

const PID_FILE = join(DATA_DIR, 'data/cron.pid');

function readPid() {
    if (!existsSync(PID_FILE)) return null;
    const pid = parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10);
    return isNaN(pid) ? null : pid;
}

function profileInterval() {
    try { return loadProfile()?.automation?.cron_interval || null; } catch { return null; }
}

// ── Commands ──────────────────────────────────────────────────────────────────

function cmdStart(args) {
    const interval   = argValue(args, '--interval') || profileInterval() || '30m';
    const foreground = args.includes('--foreground');

    const existingPid = readPid();
    if (existingPid && isRunning(existingPid)) {
        console.log(`\n  ${pc.yellow('⚠')}  Daemon already running (PID ${existingPid})`);
        console.log(`  Stop it first: ${pc.cyan('signal-hunter cron stop')}\n`);
        process.exit(1);
    }

    if (foreground) {
        console.log(`\n  Starting in foreground (every ${interval}). Press Ctrl+C to stop.\n`);
        const child = spawn('node', [join(PKG_DIR, 'src/daemon.js'), '--interval', interval], {
            cwd: PKG_DIR, stdio: 'inherit',
        });
        child.on('exit', code => process.exit(code ?? 0));
        return;
    }

    // Background mode — detached process, logs to file
    mkdirSync(join(DATA_DIR, 'logs'), { recursive: true });
    const logFd = openSync(join(DATA_DIR, 'logs/cron.log'), 'a');
    const spawnOpts = IS_WIN
        ? { cwd: PKG_DIR, stdio: ['ignore', logFd, logFd], detached: true, windowsHide: true }
        : { cwd: PKG_DIR, stdio: ['ignore', logFd, logFd], detached: true };

    const child = spawn('node', [join(PKG_DIR, 'src/daemon.js'), '--interval', interval], spawnOpts);
    child.unref();

    setTimeout(() => {
        const pid = readPid();
        if (pid && isRunning(pid)) {
            console.log(`\n  ${pc.green('✓')}  Daemon started (PID ${pid}, every ${interval})`);
            console.log(`  Logs: ${pc.dim(join(DATA_DIR, 'logs/cron.log'))}`);
            console.log(`  Stop: ${pc.cyan('signal-hunter cron stop')}\n`);
        } else {
            console.log(`\n  ${pc.red('✗')}  Daemon failed to start — check ${pc.dim('logs/cron.log')}\n`);
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

    const killed = killProcess(pid, false);
    if (!killed) {
        console.log(`\n  ${pc.red('✗')}  Could not stop PID ${pid} — try manually\n`);
        return;
    }

    setTimeout(() => {
        if (isRunning(pid)) {
            killProcess(pid, true); // force-kill
            console.log(`\n  ${pc.yellow('!')}  PID ${pid} force-killed\n`);
        } else {
            console.log(`\n  ${pc.green('✓')}  Daemon stopped (PID ${pid})\n`);
        }
        try { unlinkSync(PID_FILE); } catch {}
    }, 1000);
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
    const interval = argValue(args, '--interval') || profileInterval() || '30m';
    const absPath  = DATA_DIR;
    const daemonJs = join(PKG_DIR, 'src', 'daemon.js').replace(/\\/g, '/');

    const mins    = interval.match(/^(\d+)m$/);
    const hours   = interval.match(/^(\d+)h$/);
    const cronExp = mins  ? `*/${mins[1]} * * * *` :
                    hours ? `0 */${hours[1]} * * *` : '*/30 * * * *';

    if (IS_WIN) {
        // Windows — Task Scheduler
        const taskName  = 'SignalHunter';
        const nodePath  = 'node';
        const daemonArg = `${join(PKG_DIR, 'src', 'daemon.js')} --interval ${interval}`;

        console.log(`
${pc.bold('  Windows — Automation Options:')}

  ${pc.bold(pc.cyan('1. Task Scheduler'))} ${pc.dim('(runs on schedule, survives reboot)')}
  ─────────────────────────────────────────────────
  Open PowerShell as Administrator and run:

  ${pc.green(`$action  = New-ScheduledTaskAction -Execute 'node' -Argument '${daemonArg}'`)}
  ${pc.green(`$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes ${mins?.[1] || 30}) -Once -At (Get-Date)`)}
  ${pc.green(`Register-ScheduledTask -TaskName '${taskName}' -Action $action -Trigger $trigger -RunLevel Highest`)}

  To remove:  ${pc.green(`Unregister-ScheduledTask -TaskName '${taskName}' -Confirm:$false`)}

  ${pc.bold(pc.cyan('2. Built-in daemon'))} ${pc.dim('(background process, lost on reboot)')}
  ─────────────────────────────────────────────────
  ${pc.green(`signal-hunter cron start --interval ${interval}`)}

  ${pc.bold(pc.cyan('3. PM2'))} ${pc.dim('(recommended — auto-restarts, survives reboot)')}
  ─────────────────────────────────────────────────
  ${pc.green(`npm install -g pm2`)}
  ${pc.green(`pm2 start "${daemonJs}" --name signal-hunter -- --interval ${interval}`)}
  ${pc.green(`pm2 save`)}
  ${pc.green(`pm2 startup`)}  ${pc.dim('(follow the printed command to auto-start on boot)')}
`);
    } else {
        // macOS / Linux
        const user = process.env.USER || process.env.LOGNAME || 'user';
        console.log(`
${pc.bold('  macOS / Linux — Automation Options:')}

  ${pc.bold(pc.cyan('1. Crontab'))} ${pc.dim('(simplest — works everywhere)')}
  ─────────────────────────────────────────────────
  Run ${pc.cyan('crontab -e')} and add:

  ${pc.green(`${cronExp} SIGNAL_HUNTER_HOME="${absPath}" node "${daemonJs}" --interval ${interval} >> "${join(absPath,'logs','cron.log')}" 2>&1`)}

  ${pc.bold(pc.cyan('2. PM2'))} ${pc.dim('(recommended — auto-restarts on crash)')}
  ─────────────────────────────────────────────────
  ${pc.green(`npm install -g pm2`)}
  ${pc.green(`pm2 start "${daemonJs}" --name signal-hunter -- --interval ${interval}`)}
  ${pc.green(`pm2 save && pm2 startup`)}  ${pc.dim('(follow the printed command)')}

  ${pc.bold(pc.cyan('3. Built-in daemon'))} ${pc.dim('(background process, lost on reboot)')}
  ─────────────────────────────────────────────────
  ${pc.green(`signal-hunter cron start --interval ${interval}`)}

  ${pc.bold(pc.cyan('4. Systemd'))} ${pc.dim('(Linux — production, survives reboots)')}
  ─────────────────────────────────────────────────
  Save to ${pc.dim('/etc/systemd/system/signal-hunter.service')}:

${pc.dim(`  [Unit]
  Description=Signal Hunter — AI lead scanner
  After=network.target

  [Service]
  Type=simple
  User=${user}
  Environment="SIGNAL_HUNTER_HOME=${absPath}"
  ExecStart=/usr/bin/node ${daemonJs} --interval ${interval}
  Restart=on-failure
  RestartSec=10

  [Install]
  WantedBy=multi-user.target`)}

  Then: ${pc.green('sudo systemctl enable --now signal-hunter')}

  ${pc.bold(pc.cyan('5. launchd'))} ${pc.dim('(macOS — survives reboots)')}
  ─────────────────────────────────────────────────
  Save to ${pc.dim(`~/Library/LaunchAgents/com.loondx.signal-hunter.plist`)}:

${pc.dim(`  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0"><dict>
    <key>Label</key><string>com.loondx.signal-hunter</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/bin/node</string>
      <string>${daemonJs}</string>
      <string>--interval</string><string>${interval}</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
      <key>SIGNAL_HUNTER_HOME</key><string>${absPath}</string>
    </dict>
    <key>StartInterval</key>
    <integer>${mins ? parseInt(mins[1]) * 60 : hours ? parseInt(hours[1]) * 3600 : 1800}</integer>
    <key>RunAtLoad</key><true/>
    <key>StandardOutPath</key><string>${join(absPath,'logs','cron.log')}</string>
    <key>StandardErrorPath</key><string>${join(absPath,'logs','cron.log')}</string>
  </dict></plist>`)}

  Then: ${pc.green(`launchctl load ~/Library/LaunchAgents/com.loondx.signal-hunter.plist`)}
`);
    }
}

// ── Route ─────────────────────────────────────────────────────────────────────
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
    ${pc.cyan('cron start')}                    Start background daemon (reads interval from profile)
    ${pc.cyan('cron start --interval 1h')}      Custom interval: 15m, 30m, 1h, 2h, 6h, 12h, 24h
    ${pc.cyan('cron start --foreground')}       Foreground mode (for Docker / systemd)
    ${pc.cyan('cron stop')}                     Stop the daemon
    ${pc.cyan('cron status')}                   Check if daemon is running
    ${pc.cyan('cron logs')}                     Tail last 50 log lines
    ${pc.cyan('cron install')}                  Print OS-specific automation setup (crontab / Task Scheduler / launchd)
`);
}
