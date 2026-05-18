#!/usr/bin/env node
import { spawn }     from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pc from 'picocolors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

// Commands that forward all remaining args to a script
const COMMANDS = {
    setup:   'setup.mjs',
    doctor:  'doctor.mjs',
    scan:    'scan.mjs',
    list:    'list.mjs',
    cron:    'cron.mjs',
    reply:   'manage.mjs',
    skip:    'manage.mjs',
    open:    'manage.mjs',
};

// Commands that don't need a profile.yml
const NO_PROFILE_NEEDED = new Set(['setup', 'doctor', 'cron']);

const HELP = `
  ${pc.bold(pc.cyan('signal-hunter'))} — AI agent that hunts buying signals for your business

  ${pc.bold('Usage:')}
    signal-hunter <command> [options]

  ${pc.bold('Core:')}
    ${pc.cyan('setup')}               Interactive setup wizard ${pc.dim('(run this first)')}
    ${pc.cyan('doctor')}              Check config, API keys, and connectivity
    ${pc.cyan('scan')}                Scan all sources for new buying signals
    ${pc.cyan('list')}                View your signal pipeline

  ${pc.bold('Signal management:')}
    ${pc.cyan('reply')} ${pc.dim('<num>')}          Show full signal + outreach angle, mark as replied
    ${pc.cyan('skip')}  ${pc.dim('<num>')}          Mark signal as skipped
    ${pc.cyan('open')}  ${pc.dim('<num>')}          Open signal URL in browser

  ${pc.bold('Automation:')}
    ${pc.cyan('cron start')}          Start background scan daemon
    ${pc.cyan('cron start --interval 1h')}  Custom interval (30m, 1h, 6h, 1d)
    ${pc.cyan('cron stop')}           Stop the daemon
    ${pc.cyan('cron status')}         Show daemon status
    ${pc.cyan('cron install')}        Show crontab / PM2 / systemd setup

  ${pc.bold('Scan options:')}
    ${pc.cyan('--source')} ${pc.dim('<name>')}      Scan one source only ${pc.dim('(hackernews|reddit|remoteok|twitter)')}
    ${pc.cyan('--dry-run')}           Qualify signals without saving

  ${pc.bold('List options:')}
    ${pc.cyan('--min-score')} ${pc.dim('<n>')}      Filter by minimum score
    ${pc.cyan('--status')} ${pc.dim('<s>')}         Filter by status ${pc.dim('(new|replied|skipped)')}
    ${pc.cyan('--limit')} ${pc.dim('<n>')}          Max results to show

  ${pc.dim('Docs → https://github.com/loondx/signal-hunter')}
  ${pc.dim('MCP  → see mcp-server.mjs for Claude Code / Cursor integration')}
`;

const cmd = process.argv[2];

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    process.exit(0);
}

const script = COMMANDS[cmd];
if (!script) {
    console.error(`\n  ${pc.red(`✗ Unknown command: "${cmd}"`)}\n`);
    console.log(HELP);
    process.exit(1);
}

// First-run guard
if (!NO_PROFILE_NEEDED.has(cmd) && !existsSync(join(ROOT, 'config/profile.yml'))) {
    console.log(`
  ${pc.yellow('⚠  No configuration found.')}
  ${pc.dim('Run the setup wizard first:')}

    ${pc.cyan('signal-hunter setup')}
`);
    process.exit(1);
}

// Forward to the right script — pass all remaining args
const child = spawn(
    'node',
    [join(ROOT, script), ...process.argv.slice(2)], // include cmd so manage.mjs can route reply/skip/open
    { stdio: 'inherit', cwd: ROOT }
);

child.on('exit',  (code) => process.exit(code ?? 0));
child.on('error', (err)  => { console.error(pc.red(err.message)); process.exit(1); });
