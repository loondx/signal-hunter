// Remote OK has a completely open JSON API — no auth, no rate limits documented.
// https://remoteok.com/api
// First element is always metadata — skip it.

const API = 'https://remoteok.com/api';
const UA  = 'signal-hunter/0.1.0';

export async function fetchRemoteOk(profile, sourcesConfig) {
    const limit = sourcesConfig?.remoteok?.posts_per_scan || 20;

    try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 12_000);

        const res = await fetch(API, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            signal: ctrl.signal,
        });
        if (!res.ok) return [];

        const json = await res.json();
        const jobs = Array.isArray(json) ? json.slice(1, limit + 1) : [];

        return jobs
            .filter(j => j.slug && (j.description || j.position))
            .map(j => ({
                id:        `remoteok_${j.slug}`,
                source:    'Remote OK',
                text:      `${j.position} at ${j.company}\n\n${stripHtml(j.description || '')}`.substring(0, 1500),
                url:       j.url || `https://remoteok.com/l/${j.slug}`,
                author:    j.company || 'Unknown',
                posted_at: j.date || new Date().toISOString(),
            }));
    } catch {
        return [];
    }
}

function stripHtml(html) {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
