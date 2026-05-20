// Reddit source — uses public RSS/Atom feeds, no auth required.
// RSS works from any IP including servers, unlike the JSON API which blocks non-browser requests.
// Feed URL: https://www.reddit.com/r/{sub}/new.rss?limit=25

// old.reddit.com RSS works from any IP without auth.
// www.reddit.com blocks bot User-Agents; old.reddit.com is lenient.
const UA    = 'Mozilla/5.0 (compatible; signal-hunter/0.1.0; +https://github.com/loondx/signal-hunter)';
const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

// ── Minimal Atom XML parser — no dependencies ─────────────────────────────────

function extractTag(xml, tag) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
    return (re.exec(xml) || [])[1]?.trim() ?? '';
}

function decodeEntities(str) {
    return str
        .replace(/&lt;/g,   '<')
        .replace(/&gt;/g,   '>')
        .replace(/&amp;/g,  '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g,  "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x200B;/g, '');
}

function stripHtml(html) {
    return decodeEntities(html)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseAtomFeed(xml, sub) {
    const entries = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    let m;

    while ((m = entryRe.exec(xml)) !== null) {
        const block = m[1];

        // Reddit RSS id is "t3_POSTID" format, not a URL
        const rawId   = extractTag(block, 'id');
        const idMatch = rawId.match(/t3_([a-z0-9]+)/i);
        if (!idMatch) continue; // skip non-post entries (subreddit-level metadata)

        const postId  = idMatch[1];
        const title   = stripHtml(extractTag(block, 'title'));
        const content = stripHtml(extractTag(block, 'content'));

        // Author is nested: <author><name>/u/username</name></author>
        const authorBlock = /<author>([\s\S]*?)<\/author>/i.exec(block);
        const author = authorBlock
            ? stripHtml(extractTag(authorBlock[1], 'name')).replace(/^\/u\//i, '')
            : 'unknown';

        const published = extractTag(block, 'published') || extractTag(block, 'updated');
        const linkMatch = /<link[^>]+href="([^"]+)"/i.exec(block);
        const rawUrl    = linkMatch ? linkMatch[1] : `https://www.reddit.com/r/${sub}/comments/${postId}/`;
        const url       = rawUrl.replace('//old.reddit.com/', '//www.reddit.com/');

        const text = `${title}\n\n${content}`.trim();
        if (text.length < 40) continue;

        entries.push({
            id:        `reddit_${postId}`,
            source:    `Reddit r/${sub}`,
            text:      text.substring(0, 1500),
            url,
            author,
            posted_at: published,
        });
    }

    return entries;
}

// ── Fetch single subreddit via RSS ────────────────────────────────────────────

async function fetchSubredditRSS(sub, limit, retries = 1) {
    const url = `https://old.reddit.com/r/${sub}/new.rss?limit=${limit}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) await SLEEP(3000); // wait before retry

        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12_000);

        try {
            const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
            clearTimeout(timer);

            if (res.status === 429) return { status: 'rate_limited', entries: [] };
            if (res.status === 403) return { status: 'forbidden',    entries: [] };
            if (res.status >= 500 && attempt < retries) continue; // retry on server errors
            if (res.status >= 400) return { status: `http_${res.status}`, entries: [] };

            const xml = await res.text();
            if (!xml.includes('<feed') && !xml.includes('<rss')) {
                return { status: 'invalid_feed', entries: [] };
            }

            return { status: 'ok', entries: parseAtomFeed(xml, sub) };
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') return { status: 'timeout', entries: [] };
            if (attempt < retries) continue;
            return { status: 'network_error', entries: [] };
        }
    }

    return { status: 'failed_after_retry', entries: [] };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchReddit(profile, sourcesConfig) {
    const subreddits =
        sourcesConfig?.subreddits ||
        sourcesConfig?.reddit?.subreddits ||
        profile.sources?.reddit?.subreddits ||
        ['forhire', 'freelance', 'webdev'];

    const limit = Math.min(
        sourcesConfig?.posts_per_scan ||
        sourcesConfig?.reddit?.posts_per_scan ||
        15,
        100
    );
    const results = [];
    const errors  = [];

    for (const sub of subreddits) {
        await SLEEP(1500); // respectful delay between subreddits

        const { status, entries } = await fetchSubredditRSS(sub, limit);

        if (status === 'rate_limited') {
            console.warn(`\n  Reddit rate limit — skipping remaining subreddits this cycle`);
            break;
        }

        if (status !== 'ok') {
            errors.push(`r/${sub}: ${status}`);
            continue;
        }

        results.push(...entries);
    }

    if (errors.length > 0) {
        console.warn(`\n  Reddit RSS issues: ${errors.join(', ')}`);
    }

    return results;
}
