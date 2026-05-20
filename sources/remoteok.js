// Remote OK has a completely open JSON API — no auth, no rate limits documented.
// https://remoteok.com/api
// First element is always metadata — skip it.
//
// We fetch a larger pool and filter OUT confirmed full-time posts before AI.
// RemoteOK tags can include: "full-time", "contract", "freelance", "part-time".
// Without tag filtering at the API level, we filter post-fetch.

const API = 'https://remoteok.com/api';
const UA  = 'signal-hunter/0.8.0';

// Tags that confirm this is a full-time employee role — skip before AI
const FULLTIME_TAGS = new Set(['full-time', 'fulltime', 'permanent', 'salaried']);
// Tags that indicate freelance/contract work — promote these
const CONTRACT_TAGS = new Set(['contract', 'freelance', 'part-time', 'contractor', 'consulting']);

function stripHtml(html) {
    return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isFullTimeOnly(job) {
    const tags = (job.tags || []).map(t => t.toLowerCase());
    const hasContract = tags.some(t => CONTRACT_TAGS.has(t));
    if (hasContract) return false;
    return tags.some(t => FULLTIME_TAGS.has(t));
}

export async function fetchRemoteOk(profile, sourcesConfig) {
    const limit = sourcesConfig?.posts_per_scan ?? sourcesConfig?.remoteok?.posts_per_scan ?? 25;
    // Fetch 3x the limit so we have enough after filtering full-time posts
    const fetchLimit = Math.min(limit * 3, 90);

    try {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12_000);

        const res = await fetch(API, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return [];

        const json = await res.json();
        const raw  = Array.isArray(json) ? json.slice(1, fetchLimit + 1) : [];

        const results = [];
        for (const j of raw) {
            if (!j.slug || !(j.description || j.position)) continue;
            if (isFullTimeOnly(j)) continue;

            const tags     = (j.tags || []).map(t => t.toLowerCase());
            const typeTag  = tags.find(t => CONTRACT_TAGS.has(t));
            const typeHint = typeTag ? ` [${typeTag.toUpperCase()}]` : '';

            results.push({
                id:        `remoteok_${j.slug}`,
                source:    'Remote OK',
                text:      [
                    `${j.position} at ${j.company}${typeHint}`,
                    j.tags?.length ? `Tags: ${j.tags.join(', ')}` : '',
                    stripHtml(j.description || ''),
                ].filter(Boolean).join('\n\n').substring(0, 1500),
                url:       j.url || `https://remoteok.com/l/${j.slug}`,
                author:    j.company || 'Unknown',
                posted_at: j.date || new Date().toISOString(),
            });
            if (results.length >= limit) break;
        }
        return results;
    } catch {
        return [];
    }
}
