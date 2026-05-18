#!/usr/bin/env node
/**
 * Signal Hunter — MCP Server
 *
 * Exposes Signal Hunter as an MCP tool so it works inside
 * Claude Code, Cursor, VS Code Copilot, or any MCP-compatible AI assistant.
 *
 * Add to ~/.claude/claude_desktop_config.json (or equivalent):
 * {
 *   "mcpServers": {
 *     "signal-hunter": {
 *       "command": "node",
 *       "args": ["/absolute/path/to/signal-hunter/mcp-server.mjs"]
 *     }
 *   }
 * }
 *
 * After npm install -g signal-hunter:
 * {
 *   "mcpServers": {
 *     "signal-hunter": { "command": "signal-hunter-mcp" }
 *   }
 * }
 */

import { Server }              from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadEnv, loadProfile, loadBusinesses, loadSourcesConfig } from './utils/config.js';
import { loadSignals, loadSeenIds, saveSeenIds, appendSignal }      from './utils/store.js';
import { preFilter, qualify }                                        from './agents/qualifier.js';
import { resolveNotification }                                       from './agents/router.js';
import { notifyDiscord }                                             from './integrations/discord-webhook.js';
import { fetchHackerNews }                                           from './sources/hackernews.js';
import { fetchReddit }                                               from './sources/reddit.js';
import { fetchRemoteOk }                                             from './sources/remoteok.js';
import { logger }                                                    from './utils/logger.js';
import { readFileSync, writeFileSync, existsSync }                   from 'fs';
import { join }                                                      from 'path';
import { DATA_DIR }                                                  from './utils/paths.js';

loadEnv();

const SIGNALS_PATH = join(DATA_DIR, 'data/signals.json');
const sleep        = (ms) => new Promise(r => setTimeout(r, ms));

const SOURCE_FETCHERS = {
    hackernews: (p, cfg) => fetchHackerNews(p, cfg),
    reddit:     (p, cfg) => fetchReddit(p, cfg),
    remoteok:   (p, cfg) => fetchRemoteOk(p, cfg),
};

// ── MCP server setup ─────────────────────────────────────────────────────────
const server = new Server(
    { name: 'signal-hunter', version: '0.1.0' },
    { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name:        'scan_signals',
            description: 'Scan configured sources (Reddit, HN, Remote OK) for new buying signals and return a summary of what was found.',
            inputSchema: {
                type: 'object',
                properties: {
                    source:  { type: 'string', description: 'Scan only this source (hackernews|reddit|remoteok). Omit to scan all.' },
                    dry_run: { type: 'boolean', description: 'If true, qualify signals but do not save or notify.', default: false },
                },
            },
        },
        {
            name:        'list_signals',
            description: 'List signals in the pipeline, sorted by AI score. Optionally filter by minimum score or status.',
            inputSchema: {
                type: 'object',
                properties: {
                    min_score: { type: 'number',  description: 'Minimum score (0-100). Default 0.', default: 0 },
                    status:    { type: 'string',  description: 'Filter by status: new|replied|skipped', default: 'new' },
                    limit:     { type: 'number',  description: 'Max results to return.', default: 20 },
                },
            },
        },
        {
            name:        'get_signal',
            description: 'Get full details of a specific signal including outreach angle and reasoning.',
            inputSchema: {
                type: 'object',
                properties: {
                    num: { type: 'number', description: 'Signal number (from list_signals)' },
                },
                required: ['num'],
            },
        },
        {
            name:        'mark_signal',
            description: 'Update the status of a signal (replied, skipped, new).',
            inputSchema: {
                type: 'object',
                properties: {
                    num:    { type: 'number', description: 'Signal number to update' },
                    status: { type: 'string', description: 'New status: replied|skipped|new', enum: ['replied', 'skipped', 'new'] },
                },
                required: ['num', 'status'],
            },
        },
    ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {

        case 'scan_signals': {
            try {
                const profile       = loadProfile();
                const businesses    = loadBusinesses();
                const sourcesConfig = loadSourcesConfig();
                const seenIds       = loadSeenIds();
                const dryRun        = args?.dry_run ?? false;
                const sourceFilter  = args?.source  ?? null;

                const enabledSources = sourceFilter
                    ? [sourceFilter]
                    : (profile.sources?.enabled || ['hackernews', 'reddit', 'remoteok']);

                const allCandidates = [];
                for (const name of enabledSources) {
                    const fetcher = SOURCE_FETCHERS[name];
                    if (!fetcher) continue;
                    try {
                        const raw   = await fetcher(profile, sourcesConfig);
                        const fresh = raw.filter(r => !seenIds.has(r.id));
                        raw.forEach(r => seenIds.add(r.id));
                        allCandidates.push(...fresh);
                    } catch (err) {
                        logger.error(`MCP scan source ${name}: ${err.message}`);
                    }
                }

                if (allCandidates.length === 0) {
                    if (!dryRun) saveSeenIds(seenIds);
                    return { content: [{ type: 'text', text: 'No new signals found across all sources.' }] };
                }

                const minScore = profile.llm?.min_score ?? 60;
                const notifyMinScore = profile.notifications?.notify_min_score ?? 70;
                let saved = 0, notified = 0;
                const savedSignals = [];

                for (let i = 0; i < allCandidates.length; i++) {
                    const candidate = allCandidates[i];
                    const { pass }  = preFilter(candidate, profile);
                    if (!pass) continue;

                    const result = await qualify(candidate, profile, businesses);
                    if (result.is_red_flag || result.score < minScore) continue;

                    const signal = { ...candidate, ...result };
                    if (!dryRun) {
                        const notification = resolveNotification(signal, businesses, profile.notifications);
                        const entry = appendSignal(signal);
                        saved++;
                        savedSignals.push(entry);
                        if (notification.discordWebhook && result.score >= notifyMinScore) {
                            if (await notifyDiscord(entry, notification.discordWebhook)) notified++;
                        }
                    } else {
                        savedSignals.push({ ...signal, num: i + 1, status: 'dry-run' });
                    }

                    if (i < allCandidates.length - 1) await sleep(1100);
                }

                if (!dryRun) saveSeenIds(seenIds);

                const summary = savedSignals.map(s =>
                    `#${s.num} [${s.score}/100] ${s.source} — ${s.reasoning || ''}\n  URL: ${s.url}\n  Outreach: ${s.outreach_angle || 'N/A'}`
                ).join('\n\n');

                const text = dryRun
                    ? `DRY RUN — Found ${savedSignals.length} signals (not saved):\n\n${summary}`
                    : `Scan complete. ${saved} signal(s) saved, ${notified} notified.\n\n${summary}`;

                return { content: [{ type: 'text', text: text || 'No qualifying signals found this run.' }] };
            } catch (err) {
                return { content: [{ type: 'text', text: `Scan error: ${err.message}` }], isError: true };
            }
        }

        case 'list_signals': {
            try {
                const minScore = args?.min_score ?? 0;
                const status   = args?.status    ?? 'new';
                const limit    = args?.limit      ?? 20;

                let signals = loadSignals();
                if (minScore > 0)  signals = signals.filter(s => s.score >= minScore);
                if (status)        signals = signals.filter(s => s.status === status);
                signals = signals.sort((a, b) => b.score - a.score).slice(0, limit);

                if (signals.length === 0) {
                    return { content: [{ type: 'text', text: `No signals found (min_score: ${minScore}, status: ${status}).` }] };
                }

                const lines = signals.map(s => [
                    `#${s.num} [${s.score}/100] ${s.urgency?.toUpperCase() || 'NORMAL'} — ${s.source}`,
                    `  Summary: ${s.text?.substring(0, 100)}...`,
                    s.budget_hint ? `  Budget: ${s.budget_hint}` : '',
                    `  Reasoning: ${s.reasoning || 'N/A'}`,
                    `  URL: ${s.url}`,
                    `  Status: ${s.status}  |  Saved: ${s.saved_at?.split('T')[0] || 'unknown'}`,
                ].filter(Boolean).join('\n'));

                return { content: [{ type: 'text', text: `${signals.length} signal(s):\n\n${lines.join('\n\n')}` }] };
            } catch (err) {
                return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
            }
        }

        case 'get_signal': {
            try {
                const num     = args?.num;
                const signals = loadSignals();
                const s       = signals.find(sig => sig.num === num);
                if (!s) return { content: [{ type: 'text', text: `Signal #${num} not found.` }] };

                const text = [
                    `Signal #${s.num} — Score ${s.score}/100 (${s.urgency || 'normal'} urgency)`,
                    `Source: ${s.source}  |  Author: ${s.author}`,
                    `URL: ${s.url}`,
                    `Status: ${s.status}  |  Saved: ${s.saved_at?.split('T')[0]}`,
                    '',
                    '── Signal Content ──',
                    s.text,
                    '',
                    '── AI Analysis ──',
                    `Reasoning: ${s.reasoning || 'N/A'}`,
                    `Budget hint: ${s.budget_hint || 'none detected'}`,
                    `Business match: ${s.business_match || 'your profile'}`,
                    '',
                    '── Suggested Outreach ──',
                    s.outreach_angle || 'N/A',
                ].join('\n');

                return { content: [{ type: 'text', text }] };
            } catch (err) {
                return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
            }
        }

        case 'mark_signal': {
            try {
                const { num, status } = args;
                if (!existsSync(SIGNALS_PATH)) return { content: [{ type: 'text', text: 'No pipeline found.' }] };

                const signals = JSON.parse(readFileSync(SIGNALS_PATH, 'utf8'));
                const idx = signals.findIndex(s => s.num === num);
                if (idx === -1) return { content: [{ type: 'text', text: `Signal #${num} not found.` }] };

                signals[idx] = { ...signals[idx], status, updated_at: new Date().toISOString() };
                writeFileSync(SIGNALS_PATH, JSON.stringify(signals, null, 2));

                return { content: [{ type: 'text', text: `Signal #${num} status updated to "${status}".` }] };
            } catch (err) {
                return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
            }
        }

        default:
            return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
});

// ── Start server ──────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
logger.info('Signal Hunter MCP server started on stdio.');
