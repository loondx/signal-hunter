// GitHub Issues search — finds hiring/freelance signals in public repos.
// Inspired by loondx-ops-bot/automation/cronJobs.js pollGitHub().
//
// Uses GitHub REST API search/issues — public, free, no auth required.
// With GITHUB_TOKEN: 30 req/min. Without: 10 req/min (usually enough).
//
// Add GITHUB_TOKEN=ghp_... to .env for better rate limits:
//   GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained
//   No special permissions needed — public repo read access only.
//
// sources.yml config:
//   github:
//     type: github
//     enabled: true
//     config:
//       queries:
//         - '"looking for developer" is:issue is:open'
//         - '"hire developer" is:issue is:open'
//         - '"automation developer" is:issue is:open'
//       posts_per_scan: 20

const API   = 'https://api.github.com/search/issues';
const UA    = 'signal-hunter/0.8.0 (+https://github.com/loondx/signal-hunter)';
const SLEEP = ms => new Promise(r => setTimeout(r, ms));

const DEFAULT_QUERIES = [
    '"looking for developer" is:issue is:open',
    '"hire developer" OR "hiring developer" is:issue is:open',
    '"need a developer" is:issue is:open',
    '"freelance developer" OR "freelance engineer" is:issue is:open',
    '"automation developer" OR "n8n developer" is:issue is:open',
    '"discord bot" developer hire is:issue is:open',
];

async function searchIssues(query, token, perPage = 5) {
    const url = `${API}?q=${encodeURIComponent(query)}&sort=created&order=desc&per_page=${perPage}`;
    const headers = {
        'User-Agent': UA,
        'Accept':     'application/vnd.github+json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
        const res = await fetch(url, { headers, signal: ctrl.signal });
        clearTimeout(timer);
        if (res.status === 403 || res.status === 422) return [];
        if (!res.ok) return [];
        const json = await res.json();
        return json.items || [];
    } catch {
        clearTimeout(timer);
        return [];
    }
}

export async function fetchGitHub(profile, sourcesConfig) {
    const token   = process.env.GITHUB_TOKEN || null;
    const cfg     = sourcesConfig?.github?.config || sourcesConfig?.github || {};
    const queries = cfg.queries || DEFAULT_QUERIES;
    const limit   = cfg.posts_per_scan || 20;
    const perQ    = Math.max(3, Math.ceil(limit / queries.length));

    const results = [];
    const seen    = new Set();

    for (const query of queries.slice(0, 6)) {
        await SLEEP(token ? 500 : 1500); // rate limit respect

        const issues = await searchIssues(query, token, perQ);
        for (const issue of issues) {
            if (seen.has(issue.id)) continue;
            seen.add(issue.id);

            const repo  = issue.repository_url?.replace('https://api.github.com/repos/', '') || '';
            const body  = (issue.body || '').replace(/<!--[\s\S]*?-->/g, '').trim();
            const text  = [
                issue.title || '',
                repo ? `Repository: ${repo}` : '',
                body,
            ].filter(Boolean).join('\n\n').substring(0, 1500);

            if (text.length < 40) continue;

            results.push({
                id:        `github_${issue.id}`,
                source:    'GitHub Issues',
                text,
                url:       issue.html_url,
                author:    issue.user?.login || 'unknown',
                posted_at: issue.created_at || new Date().toISOString(),
            });
        }
        if (results.length >= limit) break;
    }

    return results.slice(0, limit);
}
