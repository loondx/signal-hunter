#!/usr/bin/env node
import * as p   from '@clack/prompts';
import pc        from 'picocolors';
import { fileURLToPath } from 'url';
import { loadEnv, loadProfile, loadBusinesses, loadSourcesConfig } from './utils/config.js';
import { loadSeenIds, saveSeenIds, appendSignal }                   from './utils/store.js';
import { preFilter, qualify }                                        from './agents/qualifier.js';
import { resolveNotification }                                       from './agents/router.js';
import { notifyDiscord }                                             from './integrations/discord-webhook.js';
import { fetchHackerNews }                                           from './sources/hackernews.js';
import { fetchReddit }                                               from './sources/reddit.js';
import { fetchRemoteOk }                                             from './sources/remoteok.js';
import { fetchCustomUrl }                                            from './sources/custom.js';
import { fetchTwitter }                                              from './sources/twitter.js';
import { logger }                                                    from './utils/logger.js';

loadEnv();

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function argValue(args, flag) {
    const idx = args.indexOf(flag);
    if (idx >= 0 && args[idx + 1]) return args[idx + 1];
    const prefixed = args.find(a => a.startsWith(flag + '='));
    return prefixed ? prefixed.split('=').slice(1).join('=') : null;
}

// ── Source registry ───────────────────────────────────────────────────────────
const SOURCE_FETCHERS = {
    hackernews: (p, cfg) => fetchHackerNews(p, cfg),
    reddit:     (p, cfg) => fetchReddit(p, cfg),
    remoteok:   (p, cfg) => fetchRemoteOk(p, cfg),
    twitter:    (p, cfg) => fetchTwitter(p, cfg),
};

// ── Core scan logic (exported for cron daemon + MCP server) ──────────────────
export async function runScan({ dryRun = false, sourceFilter = null, quiet = false, minScoreOverride = null } = {}) {
    if (!quiet) {
        console.log('');
        p.intro(
            pc.bgCyan(pc.black('  Signal Hunter  ')) +
            ' scanning' +
            (dryRun ? '  ' + pc.bgYellow(pc.black(' DRY RUN ')) : '')
        );
    }

    const profile       = loadProfile();
    const businesses    = loadBusinesses();
    const sourcesConfig = loadSourcesConfig();
    const seenIds       = loadSeenIds();

    const enabledSources = sourceFilter
        ? [sourceFilter]
        : (profile.sources?.enabled || ['hackernews', 'reddit', 'remoteok']);

    logger.info(`Scan started. Sources: [${enabledSources.join(', ')}]. Seen IDs: ${seenIds.size}`);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const allCandidates = [];

    for (const name of enabledSources) {
        if (name === 'custom') {
            const urls = sourcesConfig?.custom_urls?.urls || [];
            for (const urlCfg of urls) {
                const s = quiet ? { start: () => {}, stop: () => {} } : p.spinner();
                s.start(`Fetching custom URL: ${urlCfg.label || urlCfg.url}...`);
                const raw   = await fetchCustomUrl(urlCfg);
                const fresh = raw.filter(r => !seenIds.has(r.id));
                raw.forEach(r => seenIds.add(r.id));
                s.stop(`custom: ${urlCfg.label} → ${raw.length} chunks, ${fresh.length} new`);
                allCandidates.push(...fresh);
            }
            continue;
        }

        const fetcher = SOURCE_FETCHERS[name];
        if (!fetcher) { !quiet && p.log.warn(`Unknown source "${name}" — skipping`); continue; }

        // Pre-flight checks — warn early instead of silently returning 0
        if (name === 'twitter' && !process.env.TWITTER_BEARER_TOKEN) {
            !quiet && p.log.warn(`Twitter skipped — TWITTER_BEARER_TOKEN not set in .env`);
            !quiet && p.log.warn(`  Get one free at developer.x.com → Create App → Keys & Tokens`);
            continue;
        }
        const s = quiet ? { start: () => {}, stop: () => {} } : p.spinner();
        s.start(`Fetching ${name}...`);
        try {
            const raw   = await fetcher(profile, sourcesConfig);
            const fresh = raw.filter(r => !seenIds.has(r.id));
            raw.forEach(r => seenIds.add(r.id));
            s.stop(`${name} → ${raw.length} fetched, ${pc.cyan(String(fresh.length) + ' new')}`);
            allCandidates.push(...fresh);
        } catch (err) {
            s.stop(pc.red(`${name} → failed: ${err.message}`));
            logger.error(`Source ${name} error: ${err.message}`);
        }
    }

    if (allCandidates.length === 0) {
        if (!dryRun) saveSeenIds(seenIds);
        !quiet && p.outro('No new signals found. Try again later or add more sources.');
        return { saved: 0, notified: 0, total: 0 };
    }

    // ── Pre-filter ─────────────────────────────────────────────────────────
    const preFiltered = [];
    let preFilterRejected = 0;
    for (const c of allCandidates) {
        const { pass, reason } = preFilter(c, profile);
        if (pass) { preFiltered.push(c); }
        else { preFilterRejected++; logger.debug(`Pre-filter rejected [${c.id}]: ${reason}`); }
    }

    !quiet && p.log.info(
        `Pre-filter: ${allCandidates.length} total → ${pc.green(String(preFiltered.length) + ' to qualify')} ` +
        `(${preFilterRejected} filtered out without AI)`
    );

    if (preFiltered.length === 0) {
        if (!dryRun) saveSeenIds(seenIds);
        !quiet && p.outro('No candidates passed pre-filter. Consider broadening your profile keywords.');
        return { saved: 0, notified: 0, total: allCandidates.length };
    }

    // ── AI qualification ───────────────────────────────────────────────────
    const minScore       = minScoreOverride ?? profile.llm?.min_score ?? 60;
    const notifyMinScore = profile.notifications?.notify_min_score ?? 70;

    // Interleave candidates by source so each source gets a fair share of the cap.
    // Without this, the first source would consume the entire quota every run.
    const bySource = new Map();
    for (const c of preFiltered) {
        const key = c.source;
        if (!bySource.has(key)) bySource.set(key, []);
        bySource.get(key).push(c);
    }
    const interleaved = [];
    const queues = [...bySource.values()];
    let i = 0;
    while (interleaved.length < preFiltered.length) {
        const q = queues[i % queues.length];
        if (q.length) interleaved.push(q.shift());
        i++;
        if (queues.every(q => q.length === 0)) break;
    }

    const maxCandidates = sourcesConfig?.max_candidates_per_scan ?? 15;
    const toQualify     = interleaved.slice(0, maxCandidates);
    if (!quiet && preFiltered.length > maxCandidates) {
        p.log.warn(`Capping at ${maxCandidates} AI calls this run (${preFiltered.length} candidates). Adjust max_candidates_per_scan in config/sources.yml to change.`);
    }

    let saved = 0, notified = 0, redFlags = 0;

    !quiet && p.log.step(`Qualifying ${toQualify.length} candidates (threshold: ${minScore})...`);
    !quiet && console.log('');

    for (let i = 0; i < toQualify.length; i++) {
        const candidate = toQualify[i];
        const prefix    = pc.dim(`  [${String(i + 1).padStart(2)}/${toQualify.length}]`);

        if (!quiet) process.stdout.write(`${prefix} ${pc.dim(candidate.source.substring(0, 25).padEnd(25))} qualifying...`);

        const result = await qualify(candidate, profile, businesses);
        const signal = { ...candidate, ...result };

        if (!quiet) {
            const statusLine =
                result.is_red_flag       ? pc.red('⛔ red flag') :
                result.score >= 80       ? pc.green(`✓ score ${result.score}`) :
                result.score >= minScore ? pc.yellow(`~ score ${result.score}`) :
                                           pc.dim(`✗ score ${result.score} (below ${minScore})`);
            const budgetTag = result.budget_hint ? pc.green(` 💰 ${result.budget_hint}`) : '';
            process.stdout.write(`\r${prefix} ${pc.dim(candidate.source.substring(0, 25).padEnd(25))} ${statusLine}${budgetTag}\n`);
        }

        if (result.is_red_flag) { redFlags++; continue; }
        if (result.score < minScore) continue;

        if (!dryRun) {
            const notification = resolveNotification(signal, businesses, profile.notifications);
            const entry = appendSignal(signal);
            saved++;
            if (notification.discordWebhook && result.score >= notifyMinScore) {
                if (await notifyDiscord(entry, notification.discordWebhook)) notified++;
            }
        }

        // 4.5s between calls = ~13 RPM — safely under Gemini free tier (15 RPM)
        if (i < toQualify.length - 1) await sleep(4500);
    }

    if (!dryRun) saveSeenIds(seenIds);

    logger.info(`Scan done. Total: ${allCandidates.length}, Qualified: ${toQualify.length}, Saved: ${saved}, Notified: ${notified}, Red flags: ${redFlags}`);

    if (!quiet) {
        console.log('');
        const summary = dryRun
            ? pc.yellow(`DRY RUN — ${preFiltered.length} would be qualified, nothing saved`)
            : [
                `Processed ${allCandidates.length}`,
                saved > 0 ? pc.green(`${saved} saved`) : pc.dim('0 saved'),
                notified > 0 ? pc.cyan(`${notified} notified`) : '',
                redFlags > 0 ? pc.red(`${redFlags} red flags blocked`) : '',
              ].filter(Boolean).join('  ·  ');
        p.outro(summary + (saved > 0 && !dryRun ? `\n  Run ${pc.cyan('signal-hunter list')} to view your pipeline.` : ''));
    }

    return { saved, notified, total: allCandidates.length, redFlags };
}

// ── Run when called directly ──────────────────────────────────────────────────
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    const args      = process.argv.slice(2);
    const dryRun    = args.includes('--dry-run');
    const source    = argValue(args, '--source');
    const minScore  = argValue(args, '--min-score');
    runScan({ dryRun, sourceFilter: source, minScoreOverride: minScore ? parseInt(minScore, 10) : null }).catch(err => {
        logger.error(`Fatal: ${err.message}`);
        console.error(pc.red(`\nFatal error: ${err.message}\n`));
        process.exit(1);
    });
}
