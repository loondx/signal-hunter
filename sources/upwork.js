// Upwork RSS feed — real client projects with budgets.
//
// HOW TO GET YOUR RSS URL (one-time setup):
// 1. Log in to Upwork at upwork.com
// 2. Go to "Find Work" → search for what you do (e.g. "react developer n8n automation")
// 3. In the URL bar, add ?rss=1 or look for the RSS icon in search results
//    OR: go directly to https://www.upwork.com/ab/feed/jobs/rss?q=YOUR+SKILLS
// 4. Upwork will redirect you to a URL containing your securityToken and userUid
// 5. Copy that full URL and paste it as UPWORK_RSS_URL in your .env
//
// Example .env entry:
//   UPWORK_RSS_URL=https://www.upwork.com/ab/feed/jobs/rss?q=react+developer+ai+automation&paging=0;20&api_params=1&securityToken=TOKEN&userUid=UID
//
// Without UPWORK_RSS_URL, this source is silently skipped.

const UA    = 'Mozilla/5.0 (compatible; signal-hunter/0.4.0; +https://github.com/loondx/signal-hunter)';
const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

function decodeEntities(s) {
    return (s || '')
        .replace(/&amp;/g,  '&').replace(/&lt;/g,   '<').replace(/&gt;/g,   '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g,  "'").replace(/&apos;/g, "'")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function stripHtml(html) {
    return decodeEntities(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRssItem(block) {
    const tag = (name) => {
        const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
        return m ? decodeEntities(m[1]).trim() : '';
    };
    const title       = stripHtml(tag('title'));
    const link        = tag('link') || tag('guid');
    const description = stripHtml(tag('description'));
    const pubDate     = tag('pubDate') || tag('dc:date') || '';
    const budget      = description.match(/Budget:\s*([^\n<]+)/i)?.[1]?.trim() || null;

    if (!title || !link) return null;
    const id = `upwork_${Buffer.from(link).toString('base64').replace(/[^a-z0-9]/gi, '').slice(-16)}`;

    return {
        id,
        source:    'Upwork',
        text:      `${title}\n\n${description}`.substring(0, 1500),
        url:       link.startsWith('http') ? link : `https://www.upwork.com${link}`,
        author:    budget ? `Client (budget: ${budget})` : 'Upwork Client',
        posted_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    };
}

function parseRssFeed(xml) {
    const items = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(xml)) !== null) {
        const item = parseRssItem(m[1]);
        if (item) items.push(item);
    }
    return items;
}

export async function fetchUpwork(profile, sourcesConfig) {
    const rssUrl = process.env.UPWORK_RSS_URL;

    if (!rssUrl) {
        // No warning — silently skip if not configured (expected for most users)
        return [];
    }

    const limit = sourcesConfig?.upwork?.posts_per_scan || 20;
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);

    try {
        const res = await fetch(rssUrl, {
            headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml' },
            signal: ctrl.signal,
        });
        clearTimeout(timer);

        if (res.status === 401 || res.status === 403) {
            console.warn('\n  Upwork: RSS token expired — regenerate your UPWORK_RSS_URL in .env');
            return [];
        }
        if (!res.ok) return [];

        const xml   = await res.text();
        const items = parseRssFeed(xml);
        return items.slice(0, limit);
    } catch (err) {
        clearTimeout(timer);
        if (err.name !== 'AbortError') {
            console.warn(`\n  Upwork fetch failed: ${err.message}`);
        }
        return [];
    }
}
