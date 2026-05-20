#!/usr/bin/env node
import * as p   from '@clack/prompts';
import pc        from 'picocolors';
import { fileURLToPath } from 'url';
import { loadEnv, loadProfile, loadBusinesses, loadSourcesConfig } from '../../utils/config.js';
import { loadSeenIds, saveSeenIds, appendSignal, isFirstRun }       from '../../utils/store.js';
import { preFilter, qualify }                                        from '../../agents/qualifier.js';
import { resolveNotification }                                       from '../../agents/router.js';
import { notifyDiscord }                                             from '../../integrations/discord-webhook.js';
import { fetchHackerNews }                                           from '../../sources/hackernews.js';
import { fetchReddit }                                               from '../../sources/reddit.js';
import { fetchRemoteOk }                                             from '../../sources/remoteok.js';
import { fetchRemotive }                                             from '../../sources/remotive.js';
import { fetchDevTo }                                               from '../../sources/devto.js';
import { fetchWebSearch }                                           from '../../sources/websearch.js';
import { fetchCustomUrl }                                            from '../../sources/custom.js';
import { fetchTwitter }                                              from '../../sources/twitter.js';
import { getLearningContext }                                        from '../../agents/learner.js';
import { logger }                                                    from '../../utils/logger.js';
import { argValue }                                                  from '../../utils/args.js';

loadEnv();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SOURCE_FETCHERS = {
    hackernews: (profile, cfg) => fetchHackerNews(profile, cfg),
    reddit:     (profile, cfg) => fetchReddit(profile, cfg),
    remoteok:   (profile, cfg) => fetchRemoteOk(profile, cfg),
    remotive:   (profile, cfg) => fetchRemotive(profile, cfg),
    devto:      (profile, cfg) => fetchDevTo(profile, cfg),
    websearch:  (profile, cfg) => fetchWebSearch(profile, cfg),
    twitter:    (profile, cfg) => fetchTwitter(profile, cfg),
};

export async function runScan({ dryRun = false, sourceFilter = null, quiet = false, minScoreOverride = null } = {}) {
    if (!quiet) {
        console.log('');
        p.intro(
            pc.bgCyan(pc.black('  Signal Hunter  ')) +
            ' scanning' +
            (dryRun ? '  ' + pc.bgYellow(pc.black(' DRY RUN ')) : '')
        );
    }

    const profile        = loadProfile();
    const businesses     = loadBusinesses();
    const sourcesConfig  = loadSourcesConfig();
    const firstRun       = isFirstRun();
    const seenIds        = loadSeenIds();
    const learningCtx    = getLearningContext();

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

    // ── First-run baseline: don't flood notifications on fresh install ────────
    // Hermes-agent pattern: first run records all IDs as seen, no qualifying.
    // Second run (30 min later) processes only truly new posts.
    if (firstRun && !dryRun) {
        saveSeenIds(seenIds);
        const total = allCandidates.length;
        logger.info(`First run: recorded ${seenIds.size} IDs as baseline. Next scan will find new signals.`);
        !quiet && p.outro(
            pc.yellow(`First run complete — ${total} posts recorded as baseline.`) +
            `\n  Next scan (in ~30 min) will find genuinely new signals and notify you.` +
            `\n  Run ${pc.cyan('signal-hunter cron start')} to automate this.`
        );
        return { saved: 0, notified: 0, total, firstRun: true };
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

    // ── Source priority scoring ────────────────────────────────────────────
    // BUG FIX: naive round-robin by source NAME lets Reddit's 30+ subreddits eat
    // all AI quota. Instead, score each candidate by source quality and sort
    // highest-signal sources first. Job boards (actual paid work) always qualify
    // before discussion threads.
    function sourcePriority(src) {
        if (!src) return 10;
        if (/^(Remote OK|Remotive)/i.test(src))                                    return 100; // paid job listings
        if (/^Web Search/i.test(src))                                               return  95; // targeted internet search
        if (/^Dev\.to/i.test(src))                                                  return  85; // dev community with #hiring
        if (/^Hacker News Jobs/i.test(src))                                         return  90; // HN direct job posts
        if (/^Hacker News/i.test(src))                                              return  75;
        if (/We Work Remotely|IndieHackers/i.test(src))                             return  80;
        if (/^Reddit r\/(forhire|freelance_forhire|for_hire|hiring|DeveloperJobs|remotejobs)/i.test(src)) return 65;
        if (/^Reddit r\/(startups|startup|SaaS|Entrepreneur|smallbusiness|small_business|indiehackers)/i.test(src)) return 45;
        if (/^Reddit r\/(n8n|automation|nocode|AI_Agents|aiagents|openai)/i.test(src)) return 50;
        if (/^Reddit/i.test(src))                                                   return  30;
        return 40;
    }

    const prioritized = [...preFiltered].sort((a, b) => sourcePriority(b.source) - sourcePriority(a.source));

    const maxCandidates = sourcesConfig?.max_candidates_per_scan ?? 25;
    const toQualify     = prioritized.slice(0, maxCandidates);
    if (!quiet && preFiltered.length > maxCandidates) {
        p.log.warn(`Capping at ${maxCandidates} AI calls this run (${preFiltered.length} candidates). Top sources: ${[...new Set(toQualify.slice(0,5).map(c => c.source))].join(', ')}`);
    }

    let saved = 0, notified = 0, redFlags = 0;

    !quiet && p.log.step(`Qualifying ${toQualify.length} candidates (threshold: ${minScore})...`);
    !quiet && console.log('');

    for (let i = 0; i < toQualify.length; i++) {
        const candidate = toQualify[i];
        const prefix    = pc.dim(`  [${String(i + 1).padStart(2)}/${toQualify.length}]`);

        if (!quiet) process.stdout.write(`${prefix} ${pc.dim(candidate.source.substring(0, 25).padEnd(25))} qualifying...`);

        const result = await qualify(candidate, profile, businesses, learningCtx);
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

        // Explain why Discord didn't fire — avoids silent confusion
        if (!dryRun && saved > 0 && notified === 0) {
            const hasWebhook = !!(process.env.DISCORD_WEBHOOK_URL || profile.notifications?.discord_webhook);
            if (!hasWebhook) {
                p.log.warn(`Discord not configured — add ${pc.cyan('DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...')} to .env`);
            } else {
                p.log.warn(`Signal score below notify threshold (${notifyMinScore}) — lower ${pc.cyan('notify_min_score')} in config/profile.yml to get pinged`);
            }
        }

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

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    const args     = process.argv.slice(2);
    const dryRun   = args.includes('--dry-run');
    const source   = argValue(args, '--source');
    const minScore = argValue(args, '--min-score');
    runScan({ dryRun, sourceFilter: source, minScoreOverride: minScore ? parseInt(minScore, 10) : null }).catch(err => {
        logger.error(`Fatal: ${err.message}`);
        console.error(pc.red(`\nFatal error: ${err.message}\n`));
        process.exit(1);
    });
}
