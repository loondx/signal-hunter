const ALGOLIA   = 'https://hn.algolia.com/api/v1';
const FIREBASE  = 'https://hacker-news.firebaseio.com/v0';
const UA        = 'signal-hunter/0.1.0 (open source; github.com/loondx/signal-hunter)';
const WEEK_AGO  = () => Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

async function safeFetch(url, ms = 10_000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
        return res.ok ? res : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ── HN job stories (Firebase API) ────────────────────────────────────────────
async function fetchJobStories() {
    const res = await safeFetch(`${FIREBASE}/jobstories.json`);
    if (!res) return [];

    const ids = await res.json();
    const results = [];

    for (const id of ids.slice(0, 10)) {
        const r = await safeFetch(`${FIREBASE}/item/${id}.json`);
        if (!r) continue;
        const story = await r.json();
        if (!story?.title) continue;

        const text = [story.title, story.text].filter(Boolean).join('\n').substring(0, 1500);
        results.push({
            id:        `hn_job_${story.id}`,
            source:    'Hacker News Jobs',
            text,
            url:       story.url || `https://news.ycombinator.com/item?id=${story.id}`,
            author:    story.by || 'unknown',
            posted_at: new Date((story.time || 0) * 1000).toISOString(),
        });
    }
    return results;
}

// ── Algolia full-text search ──────────────────────────────────────────────────
async function searchAlgolia(query) {
    const url =
        `${ALGOLIA}/search_by_date` +
        `?query=${encodeURIComponent(query)}` +
        `&tags=(story,comment)` +
        `&hitsPerPage=10` +
        `&numericFilters=created_at_i>${WEEK_AGO()}`;

    const res = await safeFetch(url);
    if (!res) return [];
    const json = await res.json();

    return (json.hits || [])
        .filter(h => (h.comment_text || h.story_text || h.title || '').length > 30)
        .map(h => {
            const body = (h.comment_text || h.story_text || '').substring(0, 1500);
            return {
                id:        `hn_${h.objectID}`,
                source:    'Hacker News',
                text:      h.title ? `${h.title}\n${body}` : body,
                url:       h.story_url || `https://news.ycombinator.com/item?id=${h.objectID}`,
                author:    h.author || 'unknown',
                posted_at: h.created_at,
            };
        });
}

// ── Build search queries from profile ────────────────────────────────────────
function buildQueries(profile) {
    const queries = ['freelance developer contractor', 'looking for developer help', 'need engineer contractor'];

    // Add top service keywords as a focused query
    const serviceWords = (profile.services?.what_you_do || '')
        .split(/[,\s]+/)
        .filter(w => w.length > 4)
        .slice(0, 5);
    if (serviceWords.length) queries.push(serviceWords.join(' '));

    return queries;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchHackerNews(profile) {
    const [jobStories, ...searchBatches] = await Promise.all([
        fetchJobStories(),
        ...buildQueries(profile).map(q => searchAlgolia(q)),
    ]);

    const all = [jobStories, ...searchBatches].flat();

    // Deduplicate within this batch by ID
    const seen = new Set();
    return all.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
    });
}
