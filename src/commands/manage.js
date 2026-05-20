#!/usr/bin/env node
// signal-hunter reply <num>  — full AI outreach package, mark as replied
// signal-hunter skip  <num>  — mark as skipped
// signal-hunter open  <num>  — open signal URL in browser
import pc               from 'picocolors';
import { execSync }     from 'child_process';
import { writeFileSync } from 'fs';
import { join }         from 'path';
import { loadEnv, loadProfile }   from '../../utils/config.js';
import { loadSignals }             from '../../utils/store.js';
import { DATA_DIR }                from '../../utils/paths.js';
import { recordFeedback }          from '../../agents/learner.js';
import { generateOutreach }        from '../../agents/outreach.js';

loadEnv();

const SIGNALS_PATH = join(DATA_DIR, 'data/signals.json');

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

function hr() { console.log(`  ${pc.dim('─'.repeat(62))}`); }

function boxed(label, value, color = pc.white) {
    if (!value) return;
    console.log(`\n  ${pc.bold(label)}`);
    hr();
    for (const line of String(value).split('\n')) {
        const words = line.split(' ');
        let current = '';
        for (const word of words) {
            if ((current + ' ' + word).length > 72 && current) {
                console.log(`  ${color(current.trim())}`);
                current = word;
            } else {
                current += ' ' + word;
            }
        }
        if (current.trim()) console.log(`  ${color(current.trim())}`);
    }
}

function printMessage(text) {
    for (const line of (text || '').split('\n')) {
        if (!line.trim()) { console.log(''); continue; }
        const words = line.split(' ');
        let current = '';
        for (const word of words) {
            if ((current + ' ' + word).length > 72 && current) {
                console.log(`  ${pc.white(current.trim())}`);
                current = word;
            } else { current += ' ' + word; }
        }
        if (current.trim()) console.log(`  ${pc.white(current.trim())}`);
    }
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdReply(num) {
    const s = findSignal(num);
    if (!s) {
        console.log(`\n  ${pc.red(`Signal #${num} not found.`)}  Run ${pc.cyan('signal-hunter list')} to see your pipeline.\n`);
        process.exit(1);
    }

    const urgIcon = s.urgency === 'urgent' ? '🔥' : s.score >= 70 ? '✓' : '·';
    console.log('');
    console.log(`  ${pc.bgGreen(pc.black(` Signal #${s.num} — Score ${s.score}/100 `))}  ${urgIcon}  ${pc.dim(s.source)}`);

    boxed('📝 Their Post',      s.text?.substring(0, 500), pc.dim);
    boxed('💡 Why This Lead',   s.reasoning, pc.white);
    if (s.budget_hint) boxed('💰 Budget Signal', s.budget_hint, pc.green);

    console.log(`\n  ${pc.bold('🔗 URL:')} ${pc.cyan(s.url)}`);
    console.log('');

    // ── Generate full AI outreach package ─────────────────────────────────────
    let profile;
    try { profile = loadProfile(); } catch { profile = null; }

    if (profile) {
        process.stdout.write(`  ${pc.dim('Generating personalized outreach strategy...')}`);
        const outreach = await generateOutreach(s, profile);
        process.stdout.write('\r' + ' '.repeat(55) + '\r');

        // ── HOW TO SEND ──────────────────────────────────────────────────────
        console.log(`  ${pc.bold(pc.yellow('📬 HOW TO REACH THEM'))}`);
        hr();
        console.log(`  Platform: ${pc.yellow(outreach.platform)}`);
        console.log(`  ${outreach.how_to_send}`);
        console.log('');

        // ── MAIN MESSAGE (copy-paste ready) ──────────────────────────────────
        if (outreach.subject) {
            console.log(`  ${pc.bold('Subject:')} ${outreach.subject}`);
            console.log('');
        }
        console.log(`  ${pc.bold(pc.green('✉  MESSAGE — Select all and copy'))}`);
        hr();
        console.log('');
        printMessage(outreach.message);
        console.log('');
        hr();

        // ── WHY YOU WIN ──────────────────────────────────────────────────────
        if (outreach.why_you_win) {
            console.log(`\n  ${pc.bold('💪 Your edge:')} ${pc.yellow(outreach.why_you_win)}`);
        }

        // ── SCOPE QUESTIONS ──────────────────────────────────────────────────
        if (outreach.scope_questions?.length) {
            console.log(`\n  ${pc.bold('❓ Ask them first:')}`);
            for (const q of outreach.scope_questions) {
                console.log(`     • ${pc.dim(q)}`);
            }
        }

        // ── FOLLOW-UP ────────────────────────────────────────────────────────
        if (outreach.followup_day4) {
            console.log(`\n  ${pc.bold('🔁 Follow-up (send day 3-4 if silence):')}`);
            hr();
            console.log(`  ${pc.dim(outreach.followup_day4)}`);
        }

        // ── PROPOSAL OPENER ──────────────────────────────────────────────────
        if (outreach.proposal_opener) {
            console.log(`\n  ${pc.bold('📋 If they say yes — open your proposal with:')}`);
            console.log(`  ${pc.dim(outreach.proposal_opener)}`);
        }

        console.log('');
    } else {
        // Fallback: show the outreach_angle if no profile
        if (s.outreach_angle) {
            console.log(`  ${pc.bold(pc.cyan('✉  Outreach Angle'))}`);
            hr();
            console.log('');
            printMessage(s.outreach_angle);
            console.log('');
        }
    }

    const updated = updateSignalStatus(num, 'replied');
    if (updated) {
        recordFeedback(updated, 'replied');
        console.log(`  ${pc.green('✓')}  Signal #${num} marked as ${pc.green('replied')}  ${pc.dim('(self-learning updated)')}`);
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
        recordFeedback(updated, 'skipped');
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
    console.log(`\n  Opening: ${pc.cyan(s.url)}\n`);
    const opener = process.platform === 'darwin' ? 'open' :
                   process.platform === 'win32'  ? 'start' : 'xdg-open';
    try {
        execSync(`${opener} "${s.url}"`, { stdio: 'ignore' });
    } catch {
        console.log(`  ${pc.dim('(Could not open browser — copy the URL above)')}`);
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
    ${pc.cyan('reply <num>')}   Full AI outreach package (message + follow-up + proposal)
    ${pc.cyan('skip  <num>')}   Mark signal as skipped
    ${pc.cyan('open  <num>')}   Open signal URL in browser

  ${pc.bold('Examples:')}
    ${pc.dim('signal-hunter reply 3')}   ${pc.dim('← generates complete message to send')}
    ${pc.dim('signal-hunter skip 7')}
    ${pc.dim('signal-hunter open 3')}
`);
    process.exit(0);
}

if (isNaN(num)) {
    console.log(`\n  ${pc.red(`"${args[1]}" is not a valid signal number.`)}\n`);
    process.exit(1);
}

if      (cmd === 'reply') cmdReply(num).catch(e => { console.error(pc.red(e.message)); process.exit(1); });
else if (cmd === 'skip')  cmdSkip(num);
else if (cmd === 'open')  cmdOpen(num);
else {
    console.log(`\n  ${pc.red(`Unknown command: ${cmd}`)}\n`);
    process.exit(1);
}
