#!/usr/bin/env node
// signal-hunter insights — stats dashboard: source performance, score distribution,
// learning summary, and actionable recommendations.
import pc           from 'picocolors';
import { loadEnv }  from '../../utils/config.js';
import { loadSignals } from '../../utils/store.js';
import { existsSync, readFileSync } from 'fs';
import { join }     from 'path';
import { DATA_DIR } from '../../utils/paths.js';

loadEnv();

const signals = loadSignals();

function lerningData() {
    const path = join(DATA_DIR, 'data/learning.json');
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

const learner = lerningData();

// ── Header ────────────────────────────────────────────────────────────────────
console.log('');
console.log('  ' + pc.bold(pc.cyan('Signal Hunter')) + pc.dim(' — Insights & Performance'));
console.log('  ' + pc.dim('─'.repeat(62)));
console.log('');

if (signals.length === 0) {
    console.log('  ' + pc.dim('No signals yet.') + '  Run ' + pc.cyan('signal-hunter scan') + ' first.\n');
    process.exit(0);
}

// ── Pipeline overview ─────────────────────────────────────────────────────────
const byStatus = { new: 0, replied: 0, skipped: 0, closed: 0 };
for (const s of signals) byStatus[s.status] = (byStatus[s.status] || 0) + 1;

console.log('  ' + pc.bold('📊 Pipeline'));
console.log(`     Total signals tracked : ${pc.bold(signals.length)}`);
console.log(
    `     Status               : ` +
    pc.cyan(`${byStatus.new} new`) + '  ' +
    pc.green(`${byStatus.replied} replied`) + '  ' +
    pc.dim(`${byStatus.skipped} skipped`)
);
console.log('');

// ── Source performance ────────────────────────────────────────────────────────
const sourceMap = {};
for (const s of signals) {
    const src = s.source || 'unknown';
    if (!sourceMap[src]) sourceMap[src] = { total: 0, replied: 0, skipped: 0, scores: [] };
    sourceMap[src].total++;
    if (s.status === 'replied') sourceMap[src].replied++;
    if (s.status === 'skipped') sourceMap[src].skipped++;
    sourceMap[src].scores.push(s.score || 0);
}

const sourceRows = Object.entries(sourceMap)
    .sort(([, a], [, b]) => b.replied - a.replied || b.total - a.total);

if (sourceRows.length > 0) {
    console.log('  ' + pc.bold('📈 Source Performance'));
    const pad = Math.max(...sourceRows.map(([src]) => src.length), 20);
    console.log('  ' + pc.dim(`  ${'Source'.padEnd(pad)}  Signals  Replied  Rate  Avg Score`));
    console.log('  ' + pc.dim('  ' + '─'.repeat(pad + 36)));
    for (const [src, s] of sourceRows) {
        const rate = s.total > 0 ? Math.round((s.replied / s.total) * 100) : 0;
        const avg  = s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : 0;
        const rateStr = s.replied > 0 ? pc.green(`${rate}%`) : pc.dim(`${rate}%`);
        const avgClr  = avg >= 70 ? pc.green : avg >= 55 ? pc.yellow : pc.dim;
        console.log(
            `     ${src.padEnd(pad)}  ` +
            `${String(s.total).padStart(7)}  ` +
            `${String(s.replied).padStart(7)}  ` +
            `${String(rate + '%').padStart(4).replace(/\d+%/, rateStr)}  ` +
            `${avgClr(String(avg).padStart(9))}`
        );
    }
    console.log('');
}

// ── Score distribution ────────────────────────────────────────────────────────
const buckets = { '90-100 🔥 hot': 0, '70-89 ✓ warm': 0, '55-69 ~ ok': 0, '< 55  · cold': 0 };
for (const s of signals) {
    if (s.score >= 90)      buckets['90-100 🔥 hot']++;
    else if (s.score >= 70) buckets['70-89 ✓ warm']++;
    else if (s.score >= 55) buckets['55-69 ~ ok']++;
    else                    buckets['< 55  · cold']++;
}

console.log('  ' + pc.bold('🎯 Score Distribution'));
for (const [label, count] of Object.entries(buckets)) {
    const bar  = '█'.repeat(Math.min(count * 3, 30));
    const clr  = label.includes('hot') ? pc.green : label.includes('warm') ? pc.yellow : pc.dim;
    console.log(`     ${label.padEnd(14)}  ${clr(bar)} ${pc.dim(count)}`);
}
console.log('');

// ── Learning summary ──────────────────────────────────────────────────────────
if (learner) {
    const replied = learner.replied?.length || 0;
    const skipped = learner.skipped?.length || 0;

    if (replied + skipped > 0) {
        console.log('  ' + pc.bold('🧠 Learning Summary'));
        console.log(`     Feedback recorded : ${pc.green(replied + ' replied')}  ${pc.dim(skipped + ' skipped')}`);

        if (replied > 0) {
            const avgScore = Math.round(learner.replied.reduce((s, r) => s + r.score, 0) / replied);
            console.log(`     Avg score you engage with : ${pc.yellow(avgScore + '/100')}`);

            const kws = learner.replied.flatMap(r => r.keywords || []);
            const kwCounts = {};
            for (const k of kws) kwCounts[k] = (kwCounts[k] || 0) + 1;
            const topKws = Object.entries(kwCounts).sort(([,a],[,b]) => b-a).slice(0,6).map(([k]) => k);
            if (topKws.length) console.log(`     Keywords in your replies : ${pc.cyan(topKws.join(', '))}`);
        }

        const srcStats = Object.entries(learner.source_stats || {})
            .filter(([, s]) => s.replied + s.skipped >= 2)
            .map(([src, s]) => {
                const rate = Math.round((s.replied / (s.replied + s.skipped)) * 100);
                return `${src}: ${pc.bold(rate + '%')}`;
            });
        if (srcStats.length) console.log(`     Source reply rates : ${srcStats.join('  ')}`);
        console.log('');
    }
}

// ── Budget & urgency breakdown ────────────────────────────────────────────────
const withBudget  = signals.filter(s => s.budget_hint).length;
const urgent      = signals.filter(s => s.urgency === 'urgent').length;
const highScore   = signals.filter(s => s.score >= 70).length;
const unreplied70 = signals.filter(s => s.score >= 70 && s.status === 'new').length;

if (withBudget > 0 || urgent > 0) {
    console.log('  ' + pc.bold('💡 Quick Stats'));
    if (withBudget) console.log(`     Signals with budget mentioned : ${pc.green(withBudget)}`);
    if (urgent)     console.log(`     Urgent signals              : ${pc.yellow(urgent)}`);
    if (highScore)  console.log(`     Score ≥70 (warm+ leads)     : ${pc.cyan(highScore)}`);
    console.log('');
}

// ── Actionable recommendations ────────────────────────────────────────────────
const tips = [];

if (unreplied70 > 0) {
    tips.push(`${pc.yellow(unreplied70 + ' warm leads')} (score ≥70) haven't been reviewed — run: ${pc.cyan('signal-hunter list --min-score 70 --status new')}`);
}

// Detect if user replied to a below-threshold signal (suggests threshold too high)
const repliedLowScore = signals.filter(s => s.status === 'replied' && s.score < 60);
if (repliedLowScore.length >= 2) {
    tips.push(`You replied to ${repliedLowScore.length} signals below score 60 — consider lowering ${pc.cyan('min_score')} in config/profile.yml`);
}

// Source that has 0 replied despite many signals
const noReplySource = sourceRows.filter(([, s]) => s.total >= 5 && s.replied === 0);
if (noReplySource.length) {
    tips.push(`Low-value sources (many signals, 0 replies): ${noReplySource.map(([src]) => pc.dim(src)).join(', ')}`);
}

// Check if Discord is configured
const discordEnv = process.env.DISCORD_WEBHOOK_URL;
if (!discordEnv) {
    tips.push(`Discord not configured — set ${pc.cyan('DISCORD_WEBHOOK_URL')} in .env to get pinged on new leads`);
}

if (tips.length > 0) {
    console.log('  ' + pc.bold('⚡ Recommendations'));
    for (const tip of tips) {
        console.log(`     • ${tip}`);
    }
    console.log('');
}

console.log('  ' + pc.dim('Run signal-hunter scan to check for new leads.'));
console.log('  ' + pc.dim('Run signal-hunter list to view your pipeline.'));
console.log('');
