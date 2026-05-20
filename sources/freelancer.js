// Freelancer.com — active project listings.
// Public API works without auth (limited fields).
// With FREELANCER_OAUTH_TOKEN: skills filter, full description, budget details.
//
// Get a free token: https://developers.freelancer.com → Create App → OAuth
// Add to .env:  FREELANCER_OAUTH_TOKEN=your_token_here
//
// Without token: source works with reduced data quality.

const API_BASE = 'https://www.freelancer.com/api/projects/0.1';
const UA       = 'signal-hunter/0.4.0 (+https://github.com/loondx/signal-hunter)';
const SLEEP    = (ms) => new Promise(r => setTimeout(r, ms));

function stripHtml(html) {
    return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Skills we want to filter for — Pankaj's niche + general tech
const TARGET_SKILLS_KEYWORDS = [
    'react', 'node', 'javascript', 'typescript', 'python', 'java',
    'api', 'automation', 'n8n', 'discord', 'bot', 'ai', 'openai', 'claude',
    'chatbot', 'saas', 'mvp', 'fullstack', 'full stack', 'backend', 'frontend',
    'nextjs', 'next.js', 'angular', 'spring', 'aws', 'serverless', 'webhook',
    'scraping', 'web scraper', 'crm', 'dashboard', 'workflow', 'zapier',
];

function isRelevant(project) {
    const text = [
        project.title || '',
        project.description || '',
        (project.jobs || []).map(j => j.name || '').join(' '),
    ].join(' ').toLowerCase();

    return TARGET_SKILLS_KEYWORDS.some(kw => text.includes(kw));
}

function formatBudget(p) {
    const type  = p.type === 'fixed' ? 'fixed' : 'hourly';
    const min   = p.budget?.minimum;
    const max   = p.budget?.maximum;
    const curr  = p.currency?.sign || '$';
    if (min && max) return `${curr}${min}–${curr}${max} ${type}`;
    if (min)        return `${curr}${min}+ ${type}`;
    return null;
}

// Freelancer skill IDs for tech/AI work — configure in sources.yml under freelancer.skill_ids
// Common IDs: JavaScript=3, Python=17, Node.js=31, React.js=43, API=1049,
//             Machine Learning=1392, ChatGPT=1124, OpenAI=1371, Automation=1043
const DEFAULT_SKILL_IDS = [3, 17, 31, 43, 1049, 1392, 1043]; // JS, Python, Node, React, API, ML, Automation

async function fetchPage(query, skillIds, token, limit, offset = 0) {
    const params = new URLSearchParams({
        compact:          'true',
        job_details:      'true',
        full_description: 'true',
        limit:            String(Math.min(limit, 50)),
        offset:           String(offset),
        languages:        'en',
    });
    if (query) params.set('query', query);
    // Append each skill ID as jobs[]
    const idsToUse = skillIds?.length ? skillIds : DEFAULT_SKILL_IDS;
    const url = `${API_BASE}/projects/active/?${params}` +
        idsToUse.map(id => `&jobs[]=${id}`).join('');

    const headers = { 'User-Agent': UA, 'Accept': 'application/json' };
    if (token) headers['Freelancer-OAuth-V1'] = token;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);

    try {
        const res = await fetch(url, { headers, signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return [];
        const json = await res.json();
        return json?.result?.projects || [];
    } catch {
        clearTimeout(timer);
        return [];
    }
}

export async function fetchFreelancer(profile, sourcesConfig) {
    const token    = process.env.FREELANCER_OAUTH_TOKEN || null;
    const cfg      = sourcesConfig?.freelancer || {};
    const limit    = cfg.posts_per_scan || 20;
    const query    = cfg.search_query  || null; // skill IDs are more reliable than text query
    const skillIds = cfg.skill_ids || DEFAULT_SKILL_IDS;

    const projects = await fetchPage(query, skillIds, token, limit);

    return projects
        .filter(isRelevant)
        .slice(0, limit)
        .map(p => {
            const budget = formatBudget(p);
            const text   = [
                p.title || '',
                budget ? `Budget: ${budget}` : '',
                p.jobs?.length ? `Skills: ${p.jobs.map(j => j.name).join(', ')}` : '',
                stripHtml(p.description || p.preview_description || ''),
            ].filter(Boolean).join('\n\n').substring(0, 1500);

            return {
                id:        `freelancer_${p.id}`,
                source:    'Freelancer.com',
                text,
                url:       p.seo_url
                    ? `https://www.freelancer.com/projects/${p.seo_url}`
                    : `https://www.freelancer.com/projects/${p.id}`,
                author:    p.owner_id ? `Client #${p.owner_id}` : 'Freelancer Client',
                posted_at: p.time_submitted
                    ? new Date(p.time_submitted * 1000).toISOString()
                    : new Date().toISOString(),
            };
        });
}
