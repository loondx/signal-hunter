// Fetches any URL via Jina.ai reader — returns clean markdown.
// Free, no auth, no API key needed.
// Usage: GET https://r.jina.ai/{url}

const UA = 'signal-hunter/0.1.0';

export async function fetchCustomUrl(urlConfig) {
    const { url, label } = urlConfig;
    if (!url) return [];

    try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 20_000);

        const res = await fetch(`https://r.jina.ai/${url}`, {
            headers: { 'User-Agent': UA, 'Accept': 'text/markdown, text/plain' },
            signal: ctrl.signal,
        });
        if (!res.ok) return [];

        const markdown = await res.text();

        // Split into paragraphs, keep meaningful ones (not nav/footer noise)
        const chunks = markdown
            .split(/\n{2,}/)
            .map(c => c.trim())
            .filter(c => c.length > 60 && c.length < 2000)
            .filter(c => !c.startsWith('#') || c.length > 80) // skip single-line headers
            .slice(0, 15);

        // Use a hash of the content as the ID so repeating content is deduped
        return chunks.map((chunk, i) => ({
            id:        `custom_${simpleHash(url)}_${i}`,
            source:    label || 'Custom URL',
            text:      chunk,
            url,
            author:    'unknown',
            posted_at: new Date().toISOString(),
        }));
    } catch {
        return [];
    }
}

function simpleHash(str) {
    let h = 0;
    for (const c of str) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
    return Math.abs(h).toString(16).slice(0, 8);
}
