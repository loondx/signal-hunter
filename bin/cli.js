#!/usr/bin/env node
import { spawn }        from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join }         from 'path';
import pc               from 'picocolors';
import { PKG_DIR, DATA_DIR } from '../utils/paths.js';

const COMMANDS = {
    setup:    'src/commands/setup.js',
    doctor:   'src/commands/doctor.js',
    scan:     'src/commands/scan.js',
    list:     'src/commands/list.js',
    cron:     'src/commands/cron.js',
    reply:    'src/commands/manage.js',
    skip:     'src/commands/manage.js',
    open:     'src/commands/manage.js',
    update:   'src/commands/update.js',
};

// These commands run even without a profile.yml
const NO_PROFILE_NEEDED = new Set(['setup', 'doctor', 'cron', 'update', 'version', '-v', '--version']);

const HELP = `
  ${pc.bold(pc.cyan('signal-hunter'))} — AI agent that hunts buying signals for your business

  ${pc.bold('Usage:')}  signal-hunter <command> [options]

  ${pc.bold('Core:')}
    ${pc.cyan('setup')}                    Interactive setup wizard ${pc.dim('(run this first)')}
    ${pc.cyan('doctor')}                   Check config, API keys, connectivity
    ${pc.cyan('scan')}                     Scan all sources for new buying signals
    ${pc.cyan('list')}                     View your signal pipeline

  ${pc.bold('Signal management:')}
    ${pc.cyan('reply')} ${pc.dim('<num>')}             Show full signal + outreach angle, mark replied
    ${pc.cyan('skip')}  ${pc.dim('<num>')}             Mark signal as skipped
    ${pc.cyan('open')}  ${pc.dim('<num>')}             Open signal URL in browser

  ${pc.bold('Automation:')}
    ${pc.cyan('cron start')}               Start background scan daemon (every 30m)
    ${pc.cyan('cron start --interval 1h')} Custom interval: 30m, 1h, 6h, 1d
    ${pc.cyan('cron stop / status / logs / install')}

  ${pc.bold('Maintenance:')}
    ${pc.cyan('update')}                   Pull latest code and update dependencies
    ${pc.cyan('version')}                  Show installed version

  ${pc.bold('Scan flags:')}
    ${pc.cyan('--source')} ${pc.dim('<name>')}         One source: hackernews|reddit|remoteok|twitter
    ${pc.cyan('--dry-run')}                Qualify without saving
    ${pc.cyan('--min-score')} ${pc.dim('<n>')}         Override score threshold for this run

  ${pc.bold('List flags:')}
    ${pc.cyan('--min-score')} ${pc.dim('<n>')}         Filter by score
    ${pc.cyan('--status')} ${pc.dim('<s>')}            Filter: new|replied|skipped
    ${pc.cyan('--limit')} ${pc.dim('<n>')}             Max results

  ${pc.dim(`Install dir: ${DATA_DIR}`)}
  ${pc.dim('Docs → https://github.com/loondx/signal-hunter')}
`;

const cmd = process.argv[2];

// ── version ───────────────────────────────────────────────────────────────────
if (!cmd || cmd === 'version' || cmd === '--version' || cmd === '-v') {
    if (!cmd) { console.log(HELP); process.exit(0); }
    try {
        const pkg = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'));
        console.log(`\n  signal-hunter v${pkg.version}  ${pc.dim('(' + PKG_DIR + ')')}\n`);
    } catch {
        console.log('\n  signal-hunter (version unknown)\n');
    }
    process.exit(0);
}

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    process.exit(0);
}

const script = COMMANDS[cmd];
if (!script) {
    console.error(`\n  ${pc.red(`✗ Unknown command: "${cmd}"`)}\n`);
    console.log(HELP);
    process.exit(1);
}

// ── First-run guard ───────────────────────────────────────────────────────────
if (!NO_PROFILE_NEEDED.has(cmd) && !existsSync(join(DATA_DIR, 'config/profile.yml'))) {
    console.log(`
  ${pc.yellow('⚠  No configuration found.')}
  ${pc.dim(`Expected: ${DATA_DIR}/config/profile.yml`)}
  ${pc.dim('Run the setup wizard:')}

    ${pc.cyan('signal-hunter setup')}
`);
    process.exit(1);
}

// ── Spawn the right script ────────────────────────────────────────────────────
const child = spawn(
    'node',
    [join(PKG_DIR, script), ...process.argv.slice(2)],
    { stdio: 'inherit', cwd: PKG_DIR }
);

child.on('exit',  (code) => process.exit(code ?? 0));
child.on('error', (err)  => { console.error(pc.red(err.message)); process.exit(1); });
