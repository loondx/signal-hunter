#!/usr/bin/env node
import { spawn }        from 'child_process';
import { existsSync }   from 'fs';
import { join, basename } from 'path';
import pc               from 'picocolors';
import { PKG_DIR, DATA_DIR } from '../utils/paths.js';
import { banner, brandLine } from '../utils/banner.js';

// The CLI is installed as both `signal-hunter` and the short alias `loondx`.
// Show help/examples under whichever name the user actually typed.
// Shell wrappers pass the typed name via SIGNAL_HUNTER_BIN; npm bin shims
// are detected from argv[1].
const INVOKED = (process.env.SIGNAL_HUNTER_BIN || basename(process.argv[1] || 'signal-hunter'))
    .replace(/\.(cmd|ps1|js)$/i, '');
const BIN     = INVOKED === 'loondx' ? 'loondx' : 'signal-hunter';

const COMMANDS = {
    setup:     'src/commands/setup.js',
    doctor:    'src/commands/doctor.js',
    scan:      'src/commands/scan.js',
    list:      'src/commands/list.js',
    insights:  'src/commands/insights.js',
    dashboard: 'src/commands/dashboard.js',
    cron:      'src/commands/cron.js',
    auth:      'src/commands/auth.js',
    reply:     'src/commands/manage.js',
    skip:      'src/commands/manage.js',
    open:      'src/commands/manage.js',
    update:    'src/commands/update.js',
};

// These commands run even without a profile.yml
const NO_PROFILE_NEEDED = new Set(['setup', 'doctor', 'cron', 'update', 'auth', 'dashboard', 'version', '-v', '--version']);

const HELP = `
  ${pc.bold(pc.cyan(BIN))} — AI agent that hunts buying signals for your business

  ${pc.bold('Usage:')}  ${BIN} <command> [options]
          ${pc.dim(`(also available as ${BIN === 'loondx' ? 'signal-hunter' : 'loondx'})`)}

  ${pc.bold('Core:')}
    ${pc.cyan('setup')}                    Interactive setup wizard ${pc.dim('(run this first)')}
    ${pc.cyan('doctor')}                   Check config, API keys, connectivity
    ${pc.cyan('doctor --test-discord')}    Send a real test message to your Discord webhook
    ${pc.cyan('scan')}                     Scan all sources for new buying signals
    ${pc.cyan('list')}                     View your signal pipeline
    ${pc.cyan('dashboard')}               Open web dashboard (http://localhost:3000)
    ${pc.cyan('insights')}                 Source performance, score stats, recommendations
    ${pc.cyan('auth')} ${pc.dim('<platform>')}        Connect paid platforms: upwork, freelancer

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
    ${pc.cyan('--source')} ${pc.dim('<name>')}         One source: hackernews|reddit|remoteok|remotive|devto|websearch
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
if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    console.log(`\n  ${brandLine()}  ${pc.dim('(' + PKG_DIR + ')')}\n`);
    process.exit(0);
}

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(banner() + HELP);
    process.exit(0);
}

// Suggest the closest command on a typo (e.g. "sacn" → "scan")
function suggest(input) {
    const names = [...Object.keys(COMMANDS), 'help', 'version'];
    const dist = (a, b) => {
        const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
        for (let j = 0; j <= b.length; j++) m[0][j] = j;
        for (let i = 1; i <= a.length; i++)
            for (let j = 1; j <= b.length; j++)
                m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        return m[a.length][b.length];
    };
    const best = names
        .map((n) => ({ n, d: dist(input.toLowerCase(), n) }))
        .sort((x, y) => x.d - y.d)[0];
    return best && best.d <= 2 ? best.n : null;
}

const script = COMMANDS[cmd];
if (!script) {
    console.error(`\n  ${pc.red(`✗ Unknown command: "${cmd}"`)}`);
    const near = suggest(cmd);
    if (near) console.error(`\n  Did you mean ${pc.cyan(`${BIN} ${near}`)}?\n`);
    else console.log(HELP);
    process.exit(1);
}

// ── First-run guard ───────────────────────────────────────────────────────────
if (!NO_PROFILE_NEEDED.has(cmd) && !existsSync(join(DATA_DIR, 'config/profile.yml'))) {
    console.log(`
  ${pc.yellow('⚠  No configuration found.')}
  ${pc.dim(`Expected: ${DATA_DIR}/config/profile.yml`)}
  ${pc.dim('Run the setup wizard:')}

    ${pc.cyan(`${BIN} setup`)}
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
