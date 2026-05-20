// PeoplePerHour — UK/EU freelance platform.
// Their RSS feed was removed; uses Jina.ai reader to extract job listings.
// No auth needed. Good for UK/EU client time zones.
//
// No .env config needed — just enable in sources.

const JINA_BASE = 'https://r.jina.ai/';
const PPH_URL   = 'https://www.peopleperhour.com/freelance-jobs';
const UA        = 'signal-hunter/0.4.0 (+https://github.com/loondx/signal-hunter)';
const SLEEP     = (ms) => new Promise(r => setTimeout(r, ms));

// Simple slug hash for IDs
function slugHash(text) {
    let h = 5381;
    for (let i = 0; i < Math.min(text.length, 100); i++) {
        h = ((h << 5) + h) + text.charCodeAt(i); h |= 0;
    }
    return Math.abs(h).toString(36);
}

export async function fetchPeoplePerHour(profile, sourcesConfig) {
    const limit = sourcesConfig?.peopleperhour?.posts_per_scan || 15;
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);

    try {
        const res = await fetch(`${JINA_BASE}${PPH_URL}`, {
            headers: { 'User-Agent': UA, 'Accept': 'text/plain, text/markdown' },
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return [];

        const md = await res.text();
        return parseJobsFromMarkdown(md, limit);
    } catch {
        clearTimeout(timer);
        return [];
    }
}

function parseJobsFromMarkdown(md, limit) {
    const results = [];
    // Jina.ai returns markdown where job listings appear as linked headings or list items
    // Look for patterns like: ## Job Title\nDescription\nBudget: $X
    const lines  = md.split('\n').filter(l => l.trim());
    let current  = null;
    const buffer = [];

    for (const line of lines) {
        const isHeading = /^#{1,3}\s+\[?(.+)\]?/.test(line);
        if (isHeading && current) {
            if (buffer.length > 0 && current.text.length > 40) {
                current.text += '\n\n' + buffer.join(' ').trim();
                results.push(current);
                if (results.length >= limit) break;
            }
            buffer.length = 0;
        }

        if (isHeading) {
            const title = line.replace(/^#+\s+/, '').replace(/\[([^\]]+)\]\([^)]+\)/, '$1').trim();
            // Extract URL from markdown link in heading
            const urlMatch = line.match(/\[([^\]]+)\]\((https?:[^)]+)\)/);
            const url = urlMatch?.[2] || '';
            current = {
                id:        `pph_${slugHash(title)}`,
                source:    'PeoplePerHour',
                text:      title,
                url:       url || PPH_URL,
                author:    'PPH Client',
                posted_at: new Date().toISOString(),
            };
        } else if (current && line.length > 10 && !line.startsWith('!')) {
            buffer.push(line.trim());
        }
    }

    // Push final buffered item
    if (current && buffer.length > 0 && results.length < limit) {
        current.text += '\n\n' + buffer.join(' ').trim();
        results.push(current);
    }

    return results
        .filter(r => r.text.length > 60 && r.url.includes('peopleperhour.com'))
        .slice(0, limit);
}
