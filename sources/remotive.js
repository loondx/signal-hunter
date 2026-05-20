// Remotive.com — free public API, no auth required.
// https://remotive.com/api/remote-jobs
// Categories: software-dev, devops-sysadmin, product, design, marketing

const API = 'https://remotive.com/api/remote-jobs';
const CATEGORIES = ['software-dev', 'devops-sysadmin', 'product'];

function stripHtml(html) {
    return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchCategory(category, limit) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
        const res = await fetch(`${API}?category=${encodeURIComponent(category)}&limit=${limit}`, {
            signal: ctrl.signal,
            headers: { 'Accept': 'application/json', 'User-Agent': 'signal-hunter/0.1.0' },
        });
        clearTimeout(timer);
        if (!res.ok) return [];
        const json = await res.json();
        return json.jobs || [];
    } catch {
        clearTimeout(timer);
        return [];
    }
}

export async function fetchRemotive(profile, sourcesConfig) {
    const limit = sourcesConfig?.remotive?.posts_per_scan || 15;
    const perCat = Math.ceil(limit / CATEGORIES.length);
    const results = [];

    for (const category of CATEGORIES) {
        const jobs = await fetchCategory(category, perCat);
        for (const job of jobs) {
            const text = [
                `${job.title} at ${job.company_name}`,
                job.tags?.length ? `Tags: ${job.tags.join(', ')}` : '',
                job.candidate_required_location ? `Location: ${job.candidate_required_location}` : '',
                job.salary ? `Salary: ${job.salary}` : '',
                stripHtml(job.description || ''),
            ].filter(Boolean).join('\n\n').substring(0, 1500);

            results.push({
                id:        `remotive_${job.id}`,
                source:    'Remotive',
                text,
                url:       job.url || `https://remotive.com/remote-jobs/${category}/${job.id}`,
                author:    job.company_name || 'Unknown Company',
                posted_at: job.publication_date || new Date().toISOString(),
            });
        }
    }

    return results.slice(0, limit);
}
