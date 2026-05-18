#!/usr/bin/env node
import pc from 'picocolors';
import { loadEnv }    from '../../utils/config.js';
import { loadSignals } from '../../utils/store.js';
import { argValue }   from '../../utils/args.js';

loadEnv();

const args      = process.argv.slice(2);
const minScore  = parseInt(argValue(args, '--min-score') || '0', 10);
const statusArg = argValue(args, '--status');
const sourceArg = argValue(args, '--source');
const limitArg  = parseInt(argValue(args, '--limit') || '50', 10);

let signals = loadSignals();

if (signals.length === 0) {
    console.log('\n  ' + pc.dim('No signals yet.') + '  Run ' + pc.cyan('signal-hunter scan') + ' to find your first ones.\n');
    process.exit(0);
}

if (minScore  > 0)   signals = signals.filter(s => s.score >= minScore);
if (statusArg)       signals = signals.filter(s => s.status === statusArg);
if (sourceArg)       signals = signals.filter(s => s.source?.toLowerCase().includes(sourceArg.toLowerCase()));

signals = signals
    .sort((a, b) => b.score - a.score)
    .slice(0, limitArg);

// ── Render ────────────────────────────────────────────────────────────────────
const URGENCY  = { urgent: '🔥', normal: '📌', low: '·' };
const STATUS_C = { new: pc.cyan, replied: pc.green, closed: pc.dim, skipped: pc.dim };

console.log('');
console.log('  ' + pc.bold(pc.cyan('Signal Hunter')) + pc.dim(' — Pipeline'));

const filterParts = [
    minScore > 0   ? `score ≥ ${minScore}` : '',
    statusArg      ? `status: ${statusArg}` : '',
    sourceArg      ? `source: ${sourceArg}` : '',
].filter(Boolean);
console.log('  ' + pc.dim(`${signals.length} signal(s)${filterParts.length ? '  (' + filterParts.join(', ') + ')' : ''}`));
console.log('');

if (signals.length === 0) {
    console.log('  ' + pc.dim('No signals match your filters.'));
    console.log('');
    process.exit(0);
}

for (const s of signals) {
    const scoreStr  = String(s.score || 0).padStart(3);
    const scoreClr  = s.score >= 80 ? pc.green : s.score >= 60 ? pc.yellow : pc.dim;
    const urgIcon   = URGENCY[s.urgency] || '·';
    const statusClr = STATUS_C[s.status] || (x => x);
    const date      = (s.saved_at || '').split('T')[0];

    // Apply color AFTER padEnd so ANSI bytes don't break alignment
    const sourcePad = (s.source || '').substring(0, 24).padEnd(24);
    const statusPad = (s.status || 'new').padEnd(8);
    console.log(
        `  ${scoreClr(`[${scoreStr}]`)} ${urgIcon}  ` +
        `${pc.bold(sourcePad)}  ` +
        `${statusClr(statusPad)}  ` +
        pc.dim(date)
    );

    const preview = (s.text || '').replace(/\n+/g, ' ').substring(0, 100);
    console.log(`         ${pc.dim(preview)}${(s.text?.length || 0) > 100 ? pc.dim('…') : ''}`);

    if (s.reasoning) {
        console.log(`         ${pc.yellow('↳')} ${s.reasoning}`);
    }
    if (s.budget_hint) {
        console.log(`         ${pc.green('💰')} ${pc.bold(s.budget_hint)}`);
    }
    if (s.outreach_angle && s.score >= 75) {
        console.log(`         ${pc.blue('✉')}  ${pc.dim(s.outreach_angle.substring(0, 120))}`);
    }
    if (s.business_match) {
        console.log(`         ${pc.magenta('→')} ${pc.dim(`routed to: ${s.business_match}`)}`);
    }
    if (s.url) {
        console.log(`         ${pc.blue(s.url)}`);
    }

    console.log('');
}

console.log(pc.dim('  Edit data/signals.json to update status: new → replied → closed'));
console.log(pc.dim('  Filters: --min-score 80  --status new  --source reddit  --limit 20'));
console.log('');
