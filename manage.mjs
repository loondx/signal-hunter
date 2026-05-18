#!/usr/bin/env node
// signal-hunter reply <num>  — show outreach angle, mark as replied
// signal-hunter skip  <num>  — mark as skipped
// signal-hunter open  <num>  — open signal URL in browser
import pc                        from 'picocolors';
import { execSync }              from 'child_process';
import { loadEnv }               from './utils/config.js';
import { loadSignals }           from './utils/store.js';
import { writeFileSync }         from 'fs';
import { join, dirname }         from 'path';
import { fileURLToPath }         from 'url';

loadEnv();

const ROOT        = dirname(fileURLToPath(import.meta.url));
const SIGNALS_PATH = join(ROOT, 'data/signals.json');

function updateSignalStatus(num, status) {
    const signals = loadSignals();
    const idx = signals.findIndex(s => s.num === num);
    if (idx === -1) return null;
    signals[idx] = { ...signals[idx], status, updated_at: new Date().toISOString() };
    writeFileSync(SIGNALS_PATH, JSON.stringify(signals, null, 2));
    return signals[idx];
}

function findSignal(num) {
    return loadSignals().find(s => s.num === num) || null;
}

function boxed(label, value, color = pc.white) {
    if (!value) return;
    console.log(`\n  ${pc.bold(label)}`);
    console.log(`  ${pc.dim('─'.repeat(60))}`);
    const lines = String(value).split('\n');
    for (const line of lines) {
        // word-wrap at ~70 chars
        const words = line.split(' ');
        let current = '';
        for (const word of words) {
            if ((current + ' ' + word).length > 70 && current) {
                console.log(`  ${color(current.trim())}`);
                current = word;
            } else {
                current += ' ' + word;
            }
        }
        if (current.trim()) console.log(`  ${color(current.trim())}`);
    }
}

// ── Commands ──────────────────────────────────────────────────────────────────

function cmdReply(num) {
    const s = findSignal(num);
    if (!s) {
        console.log(`\n  ${pc.red(`Signal #${num} not found.`)}  Run ${pc.cyan('signal-hunter list')} to see your pipeline.\n`);
        process.exit(1);
    }

    console.log('');
    console.log(`  ${pc.bgGreen(pc.black(` Signal #${s.num} — Score ${s.score}/100 `))}  ${pc.dim(s.source)}`);

    boxed('📝 Original Signal', s.text?.substring(0, 400), pc.dim);
    boxed('💡 AI Reasoning',    s.reasoning, pc.white);
    boxed('💰 Budget Hint',     s.budget_hint, pc.green);

    if (s.outreach_angle) {
        console.log(`\n  ${pc.bold(pc.cyan('✉  Suggested Outreach Opener'))}`);
        console.log(`  ${pc.dim('─'.repeat(60))}`);
        console.log('');
        // Print the outreach angle prominently
        const lines = s.outreach_angle.split(/(?<=[.!?])\s+/);
        for (const line of lines) {
            console.log(`  ${pc.white(line.trim())}`);
        }
        console.log('');
        console.log(`  ${pc.dim('(Copy the text above for your reply)')}`);
    }

    console.log(`\n  ${pc.bold('URL:')} ${pc.blue(s.url)}`);
    console.log('');

    // Mark as replied
    const updated = updateSignalStatus(num, 'replied');
    if (updated) {
        console.log(`  ${pc.green('✓')}  Signal #${num} marked as ${pc.green('replied')}`);
    }
    console.log('');
}

function cmdSkip(num) {
    const s = findSignal(num);
    if (!s) {
        console.log(`\n  ${pc.red(`Signal #${num} not found.`)}\n`);
        process.exit(1);
    }
    const updated = updateSignalStatus(num, 'skipped');
    if (updated) {
        console.log(`\n  ${pc.dim('✓')}  Signal #${num} (${s.source}) marked as ${pc.dim('skipped')}\n`);
    }
}

function cmdOpen(num) {
    const s = findSignal(num);
    if (!s) {
        console.log(`\n  ${pc.red(`Signal #${num} not found.`)}\n`);
        process.exit(1);
    }
    if (!s.url) {
        console.log(`\n  ${pc.yellow('No URL for signal #' + num)}\n`);
        return;
    }

    console.log(`\n  Opening: ${pc.blue(s.url)}\n`);

    const opener = process.platform === 'darwin' ? 'open' :
                   process.platform === 'win32'  ? 'start' : 'xdg-open';
    try {
        execSync(`${opener} "${s.url}"`, { stdio: 'ignore' });
    } catch {
        console.log(`  ${pc.dim('(Could not open browser automatically — copy the URL above)')}`);
    }
}

// ── Route ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cmd  = args[0];
const num  = parseInt(args[1], 10);

if (!cmd || cmd === '--help') {
    console.log(`
  ${pc.bold('signal-hunter')} — signal management

  ${pc.bold('Commands:')}
    ${pc.cyan('reply <num>')}   Show full signal details + outreach angle, mark as replied
    ${pc.cyan('skip  <num>')}   Mark signal as skipped (hidden from default list)
    ${pc.cyan('open  <num>')}   Open signal URL in your browser

  ${pc.bold('Examples:')}
    ${pc.dim('signal-hunter reply 3')}
    ${pc.dim('signal-hunter skip 7')}
    ${pc.dim('signal-hunter open 3')}
`);
    process.exit(0);
}

if (isNaN(num)) {
    console.log(`\n  ${pc.red(`"${args[1]}" is not a valid signal number.`)}\n`);
    process.exit(1);
}

if      (cmd === 'reply') cmdReply(num);
else if (cmd === 'skip')  cmdSkip(num);
else if (cmd === 'open')  cmdOpen(num);
else {
    console.log(`\n  ${pc.red(`Unknown manage command: ${cmd}`)}\n`);
    process.exit(1);
}
