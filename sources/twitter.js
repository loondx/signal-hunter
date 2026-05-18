// Twitter / X — public search via v2 API.
// Requires TWITTER_BEARER_TOKEN in .env.
// Free tier: 500k tweet reads/month — more than enough.
// Get a token: developer.x.com → Create App → Bearer Token (read-only)

const API = 'https://api.twitter.com/2/tweets/search/recent';

const DEFAULT_QUERIES = [
    'looking for developer freelance -is:retweet lang:en',
    'need automation help -is:retweet lang:en',
    'zapier alternative -is:retweet lang:en',
    'discord bot needed -is:retweet lang:en',
    '"n8n help" OR "n8n developer" -is:retweet lang:en',
];

export async function fetchTwitter(profile, sourcesConfig) {
    const token = process.env.TWITTER_BEARER_TOKEN;
    if (!token) return [];

    const queries     = sourcesConfig?.twitter?.queries || DEFAULT_QUERIES;
    const maxResults  = Math.min(sourcesConfig?.twitter?.posts_per_scan || 10, 100);
    const results     = [];
    const seenInBatch = new Set();

    for (const query of queries) {
        try {
            const url = new URL(API);
            url.searchParams.set('query', query);
            url.searchParams.set('max_results', String(maxResults));
            url.searchParams.set('tweet.fields', 'created_at,author_id,text');
            url.searchParams.set('expansions', 'author_id');
            url.searchParams.set('user.fields', 'username');

            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), 10_000);

            const res = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${token}` },
                signal: ctrl.signal,
            });

            if (res.status === 429) {
                console.warn('Twitter rate limit hit — skipping remaining queries');
                break;
            }
            if (!res.ok) continue;

            const json = await res.json();
            if (!json.data?.length) continue;

            // Build a username lookup map from includes
            const userMap = {};
            for (const u of json.includes?.users || []) {
                userMap[u.id] = u.username;
            }

            for (const tweet of json.data) {
                if (seenInBatch.has(tweet.id)) continue;
                seenInBatch.add(tweet.id);

                const username = userMap[tweet.author_id] || tweet.author_id;
                results.push({
                    id:        `twitter_${tweet.id}`,
                    source:    'Twitter / X',
                    text:      tweet.text,
                    url:       `https://twitter.com/${username}/status/${tweet.id}`,
                    author:    `@${username}`,
                    posted_at: tweet.created_at || new Date().toISOString(),
                });
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(`Twitter fetch error for query "${query}": ${err.message}`);
            }
        }
    }

    return results;
}
