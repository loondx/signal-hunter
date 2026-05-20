// Dev.to — free public API, no auth needed.
// Tags like #hiring contain real "I need a developer" posts.
// https://developers.forem.com/api/v1#tag/articles/operation/getArticles

const API = 'https://dev.to/api/articles';
const UA  = 'signal-hunter/0.2.0 (+https://github.com/loondx/signal-hunter)';
const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

// Tags most likely to have actual hiring intent for a freelance dev
const DEFAULT_TAGS = ['hiring', 'webdev', 'javascript', 'react', 'node', 'ai', 'automation'];

async function fetchTag(tag, perPage) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
        const res = await fetch(`${API}?tag=${encodeURIComponent(tag)}&per_page=${perPage}&page=1`, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return [];
        return await res.json();
    } catch {
        clearTimeout(timer);
        return [];
    }
}

export async function fetchDevTo(profile, sourcesConfig) {
    const cfg       = sourcesConfig?.devto || {};
    const tags      = cfg.tags || DEFAULT_TAGS;
    const perTag    = cfg.posts_per_tag || 10;
    const limit     = cfg.posts_per_scan || 30;
    const results   = [];
    const seen      = new Set();

    for (const tag of tags) {
        if (results.length >= limit) break;
        await SLEEP(500); // be polite
        const articles = await fetchTag(tag, perTag);

        for (const a of articles) {
            if (seen.has(String(a.id))) continue;
            seen.add(String(a.id));

            const text = [
                a.title || '',
                a.description || '',
                (a.tag_list || []).map(t => `#${t}`).join(' '),
            ].filter(Boolean).join('\n\n').substring(0, 1500);

            if (text.length < 30) continue;

            results.push({
                id:        `devto_${a.id}`,
                source:    `Dev.to #${tag}`,
                text,
                url:       a.url || `https://dev.to/${a.slug}`,
                author:    a.user?.username || a.user?.name || 'unknown',
                posted_at: a.published_at || new Date().toISOString(),
            });
        }
    }

    return results.slice(0, limit);
}
