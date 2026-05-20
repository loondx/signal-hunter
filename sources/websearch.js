// Web search source — searches the entire internet for hiring/freelance signals.
// Supports Brave Search API and Serper.dev (Google via proxy).
// Both have free tiers. Configure one in .env to unlock this source.
//
// Brave Search:  BRAVE_SEARCH_API_KEY  → free 2000 queries/month at https://api.search.brave.com
// Serper.dev:    SERPER_API_KEY        → free 2500 queries/month at https://serper.dev
// (Serper searches Google; Brave searches its own index — both are excellent)

const BRAVE_URL  = 'https://api.search.brave.com/res/v1/web/search';
const SERPER_URL = 'https://google.serper.dev/search';
const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

// Default queries — describe "client needs a developer" intent, not "platform to hire from"
// Queries use quotes and operators to find actual posts, not directory pages
const DEFAULT_QUERIES = [
    '"looking for" developer freelance OR contractor "automation" OR "n8n" OR "AI agent"',
    '"need someone" OR "need a developer" "react" OR "nextjs" OR "node" build',
    '"hire" freelance developer "discord bot" OR "SaaS" OR "MVP" budget',
    '"help me build" OR "help building" automation OR API OR workflow developer',
    '"available for" freelance developer AI automation 2026',
    '"project" developer freelance "budget" OR "rate" react OR node OR python',
];

// ── Brave Search API ──────────────────────────────────────────────────────────
async function braveSearch(query, key, count = 5) {
    const url = `${BRAVE_URL}?q=${encodeURIComponent(query)}&count=${count}&search_lang=en`;
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
        const res = await fetch(url, {
            headers: {
                'Accept':               'application/json',
                'Accept-Encoding':      'gzip',
                'X-Subscription-Token': key,
            },
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return [];
        const json  = await res.json();
        const items = json.web?.results || [];
        return items.map(r => ({
            title:   r.title || '',
            url:     r.url   || '',
            snippet: r.description || r.extra_snippets?.[0] || '',
        }));
    } catch {
        clearTimeout(timer);
        return [];
    }
}

// ── Serper.dev (Google Search API proxy) ─────────────────────────────────────
async function serperSearch(query, key, count = 5) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
        const res = await fetch(SERPER_URL, {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY':    key,
            },
            body:   JSON.stringify({ q: query, num: count, hl: 'en', gl: 'us', tbs: 'qdr:w' }), // last week
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return [];
        const json    = await res.json();
        const organic = json.organic || [];
        return organic.map(r => ({
            title:   r.title   || '',
            url:     r.link    || '',
            snippet: r.snippet || '',
        }));
    } catch {
        clearTimeout(timer);
        return [];
    }
}

function hashUrl(url) {
    let h = 5381;
    for (let i = 0; i < url.length; i++) { h = ((h << 5) + h) + url.charCodeAt(i); h |= 0; }
    return Math.abs(h).toString(36);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchWebSearch(profile, sourcesConfig) {
    const braveKey  = process.env.BRAVE_SEARCH_API_KEY;
    const serperKey = process.env.SERPER_API_KEY;

    if (!braveKey && !serperKey) {
        console.warn('\n  Web search: no API key found. Set BRAVE_SEARCH_API_KEY or SERPER_API_KEY in .env');
        console.warn('  → Brave free: https://api.search.brave.com  (2000 queries/month)');
        console.warn('  → Serper free: https://serper.dev            (2500 queries/month, Google results)');
        return [];
    }

    const cfg     = sourcesConfig?.websearch || {};
    const queries = cfg.queries || DEFAULT_QUERIES;
    const perQ    = cfg.results_per_query || 5;
    const maxQ    = cfg.max_queries || 5;

    const searchFn = braveKey
        ? (q) => braveSearch(q, braveKey, perQ)
        : (q) => serperSearch(q, serperKey, perQ);

    const all  = [];
    const seen = new Set();

    for (const query of queries.slice(0, maxQ)) {
        await SLEEP(1000);
        const hits = await searchFn(query);

        for (const h of hits) {
            if (!h.url || !h.title) continue;
            // Skip job board/platform directory pages — those aren't client leads
            const platformDomains = ['upwork.com', 'toptal.com', 'fiverr.com', 'freelancer.com', 'guru.com', 'indeed.com', 'linkedin.com/jobs'];
            if (platformDomains.some(d => h.url.includes(d))) continue;

            const id = `web_${hashUrl(h.url)}`;
            if (seen.has(id)) continue;
            seen.add(id);

            const text = [h.title, h.snippet].filter(Boolean).join('\n\n').substring(0, 1500);
            if (text.length < 40) continue;

            let hostname = '';
            try { hostname = new URL(h.url).hostname.replace('www.', ''); } catch {}

            all.push({
                id,
                source:    'Web Search',
                text,
                url:       h.url,
                author:    hostname,
                posted_at: new Date().toISOString(),
            });
        }
    }

    return all;
}
