// URL normalization — single place that fixes known URL issues across all sources.
//
// Rules applied in order:
//   1. old.reddit.com → www.reddit.com  (RSS feeds return old.reddit.com links)
//   2. Strip tracking params from common platforms
//   3. Ensure https for known domains

const TRACKING_PARAMS = [
    'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
    'ref','ref_src','ref_url','via','source','fbclid','gclid','mc_cid','mc_eid',
];

const REDDIT_OLD = /^(https?:)?\/\/old\.reddit\.com\//i;

export function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return url;

    let u = url.trim();

    // 1. Fix old.reddit.com → www.reddit.com
    if (REDDIT_OLD.test(u)) {
        u = u.replace(REDDIT_OLD, 'https://www.reddit.com/');
    }

    // 2. Clean tracking params on common platforms
    try {
        const parsed = new URL(u);
        let changed = false;
        for (const p of TRACKING_PARAMS) {
            if (parsed.searchParams.has(p)) { parsed.searchParams.delete(p); changed = true; }
        }
        // Remove empty query string
        if (changed) {
            u = parsed.toString().replace(/\?$/, '');
        }
    } catch {
        // Not a valid URL — return as-is
    }

    return u;
}

/** Apply normalizeUrl to a full signal object. Returns a new object. */
export function normalizeSignalUrls(signal) {
    if (!signal) return signal;
    return { ...signal, url: normalizeUrl(signal.url) };
}

/** Fix all signals in an array. Used for migrations and on-load normalization. */
export function normalizeAllUrls(signals) {
    return signals.map(normalizeSignalUrls);
}
