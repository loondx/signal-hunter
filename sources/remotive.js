// Remotive.com — free public API, no auth required.
// https://remotive.com/api/remote-jobs
//
// NOTE: The Remotive API OR-filters category + job_type, not AND.
// So we fetch by job_type only, then post-filter to tech categories.
// This guarantees we only send contract/freelance tech work to the AI.
// Full-time jobs (which scored 8-18) no longer waste AI quota.

const API = 'https://remotive.com/api/remote-jobs';
const JOB_TYPES = ['contract', 'freelance'];

// Tech-relevant category substrings (case-insensitive)
const TECH_CATS = [
    'software', 'dev', 'engineer', 'data', 'devops', 'sysadmin',
    'artificial intelligence', 'ai', 'product', 'security', 'qa',
    'mobile', 'infra', 'cloud', 'backend', 'frontend', 'full',
];

function isTechCategory(category) {
    if (!category) return false;
    const lc = category.toLowerCase();
    return TECH_CATS.some(k => lc.includes(k));
}

function stripHtml(html) {
    return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchByJobType(jobType, fetchLimit) {
    const url = `${API}?job_type=${jobType}&limit=${fetchLimit}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: { 'Accept': 'application/json', 'User-Agent': 'signal-hunter/0.8.0' },
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
    const limit      = sourcesConfig?.posts_per_scan ?? sourcesConfig?.remotive?.posts_per_scan ?? 20;
    // Fetch more than needed since we'll filter by tech category
    const fetchLimit = Math.min(limit * 3, 100);
    const seen       = new Set();
    const results    = [];

    for (const jobType of JOB_TYPES) {
        const jobs = await fetchByJobType(jobType, fetchLimit);

        for (const job of jobs) {
            if (seen.has(job.id)) continue;
            // Double-check both conditions — API job_type filter is unreliable (returns mixed types)
            if (!JOB_TYPES.includes(job.job_type)) continue;
            if (!isTechCategory(job.category)) continue;
            seen.add(job.id);

            const text = [
                `${job.title} at ${job.company_name} [${jobType.toUpperCase()}]`,
                job.category ? `Category: ${job.category}` : '',
                job.tags?.length ? `Tags: ${job.tags.join(', ')}` : '',
                job.candidate_required_location ? `Location: ${job.candidate_required_location}` : '',
                job.salary ? `Budget/Rate: ${job.salary}` : '',
                stripHtml(job.description || ''),
            ].filter(Boolean).join('\n\n').substring(0, 1500);

            results.push({
                id:        `remotive_${job.id}`,
                source:    'Remotive',
                text,
                url:       job.url || `https://remotive.com/remote-jobs/software-dev/${job.id}`,
                author:    job.company_name || 'Unknown Company',
                posted_at: job.publication_date || new Date().toISOString(),
            });
            if (results.length >= limit) break;
        }
        if (results.length >= limit) break;
    }

    return results.slice(0, limit);
}
