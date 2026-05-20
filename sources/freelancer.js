// Freelancer.com — active project listings via official API.
//
// SETUP:
//   Run: signal-hunter auth freelancer
//   This guides you to get a free OAuth token and saves it.
//
// Without FREELANCER_OAUTH_TOKEN: source works but returns mixed results.
// With token: proper auth, better results, higher rate limits.
//
// sources.yml config (fully dynamic — no hardcoded values):
//   freelancer:
//     type: freelancer
//     enabled: true
//     config:
//       posts_per_scan: 20
//       # Skill IDs to filter by (get IDs from Freelancer API /skills endpoint)
//       # Common: JavaScript=3, Python=17, Node.js=31, React.js=43,
//       #         API=1049, Machine Learning=1392, Automation=1043,
//       #         ChatGPT=1124, OpenAI=1371, TypeScript=1756
//       skill_ids: [3, 17, 31, 43, 1049, 1392, 1043]
//       # Optional: restrict to English-language projects
//       language: en

const API_BASE = 'https://www.freelancer.com/api/projects/0.1';
const UA       = 'signal-hunter/0.5.0 (+https://github.com/loondx/signal-hunter)';

function stripHtml(html) {
    return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatBudget(p) {
    const t    = p.type === 'fixed' ? 'fixed' : 'hourly';
    const sign = p.currency?.sign || '$';
    const min  = p.budget?.minimum;
    const max  = p.budget?.maximum;
    if (min && max) return `${sign}${min}–${sign}${max} ${t}`;
    if (min)        return `${sign}${min}+ ${t}`;
    return null;
}

export async function fetchFreelancer(profile, sourcesConfig) {
    const token = process.env.FREELANCER_OAUTH_TOKEN || null;
    const cfg   = sourcesConfig?.freelancer?.config || sourcesConfig?.freelancer || {};
    const limit = cfg.posts_per_scan || 20;

    // Skill IDs from config — NOT hardcoded in source code
    // Users set these in sources.yml based on their niche
    const skillIds = cfg.skill_ids || [];
    const language = cfg.language  || 'en';

    const params = new URLSearchParams({
        compact:          'true',
        job_details:      'true',
        full_description: 'true',
        limit:            String(Math.min(limit, 50)),
        languages:        language,
    });
    const url = `${API_BASE}/projects/active/?${params}` +
        skillIds.map(id => `&jobs[]=${id}`).join('');

    const headers = { 'User-Agent': UA, 'Accept': 'application/json' };
    if (token) headers['Freelancer-OAuth-V1'] = token;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
        const res = await fetch(url, { headers, signal: ctrl.signal });
        clearTimeout(timer);
        if (res.status === 401) {
            console.warn('\n  Freelancer.com: token invalid — run: signal-hunter auth freelancer');
            return [];
        }
        if (!res.ok) return [];

        const json     = await res.json();
        const projects = json?.result?.projects || [];

        return projects.slice(0, limit).map(p => {
            const budget = formatBudget(p);
            const skills = (p.jobs || []).map(j => j.name).join(', ');
            const text   = [
                p.title || '',
                budget                         ? `Budget: ${budget}`  : '',
                skills                         ? `Skills: ${skills}`  : '',
                p.jobs?.length ? `Bids: ${p.bid_stats?.bid_count || '?'}` : '',
                stripHtml(p.description || p.preview_description || ''),
            ].filter(Boolean).join('\n\n').substring(0, 1500);

            const projectSlug = p.seo_url || p.id;
            return {
                id:        `freelancer_${p.id}`,
                source:    'Freelancer.com',
                text,
                url:       `https://www.freelancer.com/projects/${projectSlug}`,
                author:    budget ? `Client (${budget})` : 'Freelancer Client',
                posted_at: p.time_submitted
                    ? new Date(p.time_submitted * 1000).toISOString()
                    : new Date().toISOString(),
            };
        }).filter(r => r.url && r.text.length > 40);

    } catch (err) {
        clearTimeout(timer);
        if (err.name !== 'AbortError') console.warn(`\n  Freelancer.com: ${err.message}`);
        return [];
    }
}
