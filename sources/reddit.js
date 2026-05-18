// Reddit source — supports both unauthenticated (dev/personal use) and
// authenticated (REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET) modes.
//
// Reddit blocks unauthenticated API calls from server IPs.
// If you're running on a VPS and getting 403/500 errors, set up OAuth:
//   1. Go to https://www.reddit.com/prefs/apps
//   2. Create a "script" app
//   3. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to .env

const UA    = 'signal-hunter/0.1.0 (open source lead tool; github.com/yourusername/signal-hunter)';
const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

let _accessToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
    if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

    const clientId     = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res   = await fetch('https://www.reddit.com/api/v1/access_token', {
        method:  'POST',
        headers: { Authorization: `Basic ${creds}`, 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    'grant_type=client_credentials',
    });
    if (!res.ok) return null;

    const json    = await res.json();
    _accessToken  = json.access_token;
    _tokenExpiry  = Date.now() + (json.expires_in - 60) * 1000;
    return _accessToken;
}

async function fetchSubreddit(sub, limit) {
    const token = await getAccessToken();
    const base  = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
    const headers = {
        'User-Agent': UA,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);

    try {
        const res = await fetch(`${base}/r/${sub}/new.json?limit=${limit}`, { headers, signal: ctrl.signal });
        clearTimeout(timer);

        if (res.status === 429) return { status: 'rate_limited', posts: [] };
        if (res.status === 403) return { status: 'forbidden',    posts: [] };
        if (res.status >= 500) return { status: `server_error_${res.status}`, posts: [] };
        if (!res.ok)           return { status: `error_${res.status}`, posts: [] };

        const json = await res.json();
        return { status: 'ok', posts: json.data?.children || [] };
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') return { status: 'timeout', posts: [] };
        return { status: 'network_error', posts: [] };
    }
}

export async function fetchReddit(profile, sourcesConfig) {
    const subreddits =
        sourcesConfig?.reddit?.subreddits ||
        profile.sources?.reddit?.subreddits ||
        ['forhire', 'freelance', 'webdev'];

    const limit   = sourcesConfig?.reddit?.posts_per_scan || 10;
    const results = [];
    const errors  = [];

    for (const sub of subreddits) {
        await SLEEP(2000); // respectful 2-second delay between subreddits

        const { status, posts } = await fetchSubreddit(sub, limit);

        if (status === 'rate_limited') {
            console.warn(`\n  Reddit rate limit (r/${sub}) — pausing this cycle`);
            break;
        }

        if (status === 'forbidden') {
            errors.push(`r/${sub}: 403 Forbidden — set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET in .env for authenticated access`);
            continue;
        }

        if (status !== 'ok') {
            errors.push(`r/${sub}: ${status}`);
            continue;
        }

        for (const post of posts) {
            const d = post.data;
            if (!d.selftext || d.over_18) continue;
            if (d.selftext === '[deleted]' || d.selftext === '[removed]') continue;
            if (d.selftext.length < 40) continue;

            results.push({
                id:        `reddit_${d.id}`,
                source:    `Reddit r/${sub}`,
                text:      `${d.title}\n\n${d.selftext}`.substring(0, 1500),
                url:       `https://www.reddit.com${d.permalink}`,
                author:    `u/${d.author}`,
                posted_at: new Date(d.created_utc * 1000).toISOString(),
            });
        }
    }

    if (errors.length > 0) {
        console.warn(`\n  Reddit issues:\n${errors.map(e => `    • ${e}`).join('\n')}`);
        if (errors.some(e => e.includes('403'))) {
            console.warn(`\n  Tip: Reddit blocks unauthenticated server requests.`);
            console.warn(`  Add REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET to .env for reliable access.`);
            console.warn(`  Setup: https://www.reddit.com/prefs/apps → "script" app type\n`);
        }
    }

    return results;
}
