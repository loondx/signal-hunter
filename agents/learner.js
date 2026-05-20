// Self-learning module — tracks which signals the user replied to vs. skipped.
// Builds a context string that the qualifier uses to improve future scoring.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DATA_DIR } from '../utils/paths.js';

const LEARNING_PATH = join(DATA_DIR, 'data/learning.json');
const MAX_HISTORY   = 100;

const INTENT_TERMS = [
    'n8n', 'make.com', 'zapier', 'automation', 'api', 'webhook', 'discord bot',
    'discord', 'saas', 'mvp', 'react', 'nextjs', 'node', 'ai agent', 'agent',
    'crm', 'dashboard', 'integrate', 'automate', 'freelance', 'contractor',
    'budget', 'hire', 'payment', 'openai', 'claude', 'llm', 'chatbot', 'workflow',
    'backend', 'frontend', 'fullstack', 'full stack', 'full-stack', 'deploy',
    'aws', 'serverless', 'microservice', 'rest api', 'graphql', 'scraper',
    'urgent', 'asap', 'quote', 'proposal', 'rate', 'project',
];

function load() {
    if (!existsSync(LEARNING_PATH)) return { replied: [], skipped: [], source_stats: {} };
    try { return JSON.parse(readFileSync(LEARNING_PATH, 'utf8')); } catch {
        return { replied: [], skipped: [], source_stats: {} };
    }
}

function save(data) {
    mkdirSync(join(DATA_DIR, 'data'), { recursive: true });
    writeFileSync(LEARNING_PATH, JSON.stringify({ ...data, updated_at: new Date().toISOString() }, null, 2));
}

function extractKeywords(text) {
    const lower = (text || '').toLowerCase();
    return INTENT_TERMS.filter(t => lower.includes(t));
}

function topKeywords(list, n = 8) {
    const counts = {};
    for (const kw of list) counts[kw] = (counts[kw] || 0) + 1;
    return Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, n)
        .map(([kw]) => kw);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function recordFeedback(signal, action) {
    const data = load();

    const entry = {
        source:   signal.source,
        score:    signal.score,
        urgency:  signal.urgency,
        budget:   !!signal.budget_hint,
        keywords: extractKeywords(signal.text || ''),
        ts:       new Date().toISOString(),
    };

    const key  = action === 'replied' ? 'replied' : 'skipped';
    data[key]  = [...(data[key] || []).slice(-(MAX_HISTORY - 1)), entry];

    data.source_stats = data.source_stats || {};
    const src = data.source_stats[signal.source] = data.source_stats[signal.source] || { replied: 0, skipped: 0 };
    src[action === 'replied' ? 'replied' : 'skipped']++;

    save(data);
}

export function getLearningContext() {
    const data  = load();
    const replied = data.replied  || [];
    const skipped = data.skipped  || [];
    if (replied.length + skipped.length < 3) return null; // not enough data yet

    const parts = [];

    // Source conversion rates
    const sourceLines = Object.entries(data.source_stats || {})
        .filter(([, s]) => s.replied + s.skipped >= 3)
        .map(([src, s]) => {
            const total = s.replied + s.skipped;
            const rate  = Math.round((s.replied / total) * 100);
            return `${src}: ${rate}% (${s.replied}/${total})`;
        });
    if (sourceLines.length) parts.push(`Source reply rates: ${sourceLines.join(', ')}`);

    // Average score of replied
    if (replied.length >= 2) {
        const avg = Math.round(replied.reduce((s, r) => s + r.score, 0) / replied.length);
        parts.push(`Average score of signals user actually replied to: ${avg}/100`);
    }

    // Keywords that appear in replied signals
    const repliedKws = topKeywords(replied.flatMap(r => r.keywords));
    if (repliedKws.length) parts.push(`Keywords common in signals user replied to: ${repliedKws.join(', ')}`);

    // Keywords common in skipped signals (negative signal)
    const skippedKws = topKeywords(skipped.flatMap(r => r.keywords));
    if (skippedKws.length) parts.push(`Keywords common in signals user skipped: ${skippedKws.join(', ')}`);

    // Budget pattern
    const repliedWithBudget = replied.filter(r => r.budget).length;
    if (replied.length >= 3) {
        const pct = Math.round((repliedWithBudget / replied.length) * 100);
        if (pct > 50) parts.push(`User replies more often when budget is mentioned (${pct}% of replies had budget)`);
    }

    return parts.length ? `\nLEARNED PATTERNS (from ${replied.length} replied, ${skipped.length} skipped signals):\n` + parts.map(p => `- ${p}`).join('\n') : null;
}
