// Generic RSS/Atom provider — reads any feed URL.
// Configured entirely from sources.yml, no code changes needed to add a feed.
//
// sources.yml config options:
//   url: "https://example.com/jobs.rss"          # direct URL
//   url_env: "MY_RSS_URL"                          # read URL from env var
//   label: "My Board"
//   auth_header_env: "MY_TOKEN"                    # adds Authorization: Bearer <token>
//   cookie_env: "MY_COOKIE"                        # adds Cookie: <value>
//   posts_per_scan: 20

const UA = 'signal-hunter/0.5.0 (+https://github.com/loondx/signal-hunter)';

function decodeEntities(s) {
    return (s || '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}
function stripHtml(h) { return decodeEntities(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function tag(block, name) {
    const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    return m ? decodeEntities(m[1]).trim() : '';
}
function slugHash(s) {
    let h = 5381;
    for (let i = 0; i < Math.min(s.length, 80); i++) { h = ((h << 5) + h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h).toString(36);
}

function parseItem(block, label) {
    const title = stripHtml(tag(block, 'title'));
    const link  = tag(block, 'link') || tag(block, 'guid');
    const desc  = stripHtml(tag(block, 'description') || tag(block, 'content') || tag(block, 'summary'));
    const date  = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'dc:date') || '';
    if (!title || !link?.startsWith('http')) return null;
    const text = `${title}\n\n${desc}`.substring(0, 1500);
    return {
        id:        `rss_${slugHash(link)}`,
        source:    label,
        text,
        url:       link,
        author:    stripHtml(tag(block, 'author') || tag(block, 'dc:creator') || '') || label,
        posted_at: date ? new Date(date).toISOString() : new Date().toISOString(),
    };
}

function parseFeed(xml, label) {
    // Atom: <entry>, RSS: <item>
    const re     = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
    const items  = [];
    let m;
    while ((m = re.exec(xml)) !== null) {
        const item = parseItem(m[1], label);
        if (item) items.push(item);
    }
    return items;
}

export async function fetchRss(sourceId, sourceConf) {
    const cfg   = sourceConf.config || {};
    const label = cfg.label || sourceId;
    const limit = cfg.posts_per_scan || 20;

    // Resolve URL — direct or from env var
    let url = cfg.url;
    if (!url && cfg.url_env) {
        url = process.env[cfg.url_env];
        if (!url) {
            console.warn(`\n  ${label}: ${cfg.url_env} not set in .env — skipping`);
            return [];
        }
    }
    if (!url) return [];

    const headers = { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' };
    if (cfg.auth_header_env) {
        const v = process.env[cfg.auth_header_env];
        if (v) headers['Authorization'] = `Bearer ${v}`;
    }
    if (cfg.cookie_env) {
        const v = process.env[cfg.cookie_env];
        if (v) headers['Cookie'] = v;
    }

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
        const res = await fetch(url, { headers, signal: ctrl.signal });
        clearTimeout(timer);
        if (res.status === 401 || res.status === 403) {
            console.warn(`\n  ${label}: auth failed (${res.status}) — check credentials in .env`);
            return [];
        }
        if (!res.ok) return [];
        const xml  = await res.text();
        const items = parseFeed(xml, label);
        return items.slice(0, limit);
    } catch (err) {
        clearTimeout(timer);
        if (err.name !== 'AbortError') console.warn(`\n  ${label}: fetch failed — ${err.message}`);
        return [];
    }
}
