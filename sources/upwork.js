// Upwork source — official OAuth2 GraphQL API.
//
// SETUP (one-time):
//   1. Register at https://developers.upwork.com → API Keys → New App
//   2. Add to .env:
//        UPWORK_CLIENT_ID=your_client_id
//        UPWORK_CLIENT_SECRET=your_client_secret
//   3. Run: signal-hunter auth upwork
//      This opens your browser, you authorize, token is saved automatically.
//
// After auth, tokens stored in .env:
//   UPWORK_ACCESS_TOKEN   (long-lived)
//   UPWORK_REFRESH_TOKEN  (for renewal)
//
// sources.yml config:
//   upwork:
//     type: upwork
//     enabled: true
//     config:
//       search_queries:
//         - "react developer automation"
//         - "AI agent node.js"
//       posts_per_scan: 20
//       min_budget: 200        # optional filter
//       hourly_only: false     # optional filter

const GRAPHQL_URL   = 'https://api.upwork.com/graphql';
const TOKEN_URL     = 'https://www.upwork.com/api/v3/oauth2/token';
const UA            = 'signal-hunter/0.5.0 (+https://github.com/loondx/signal-hunter)';

// ── Token refresh ─────────────────────────────────────────────────────────────
async function refreshToken(clientId, clientSecret, refreshToken) {
    const res = await fetch(TOKEN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body:    new URLSearchParams({
            grant_type:    'refresh_token',
            refresh_token: refreshToken,
            client_id:     clientId,
            client_secret: clientSecret,
        }),
    });
    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
    return res.json();
}

// ── GraphQL job search ────────────────────────────────────────────────────────
async function searchJobs(accessToken, query, limit) {
    // Upwork GraphQL API — job search query
    // Docs: https://developers.upwork.com/api-explorer
    const gqlQuery = `
    query SearchJobs($searchExpression: String!, $pagination: PaginationInput) {
      marketplacejobpostings_V2(
        marketJobPostingsRequest: {
          searchExpression: { query: $searchExpression }
          pagination: $pagination
        }
      ) {
        edges {
          node {
            id
            title
            description
            publishedDateTime
            contractorTier
            budget { type amount currency { code } }
            skills { name }
            client {
              location { country }
              totalFeedback
              totalReviews
              totalPostedJobs
            }
          }
        }
      }
    }`;

    const res = await fetch(GRAPHQL_URL, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent':    UA,
        },
        body: JSON.stringify({
            query: gqlQuery,
            variables: {
                searchExpression: query,
                pagination: { first: Math.min(limit, 20) },
            },
        }),
    });

    if (res.status === 401) throw new Error('UPWORK_TOKEN_EXPIRED');
    if (!res.ok) throw new Error(`Upwork GraphQL ${res.status}`);

    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error');
    return json?.data?.marketplacejobpostings_V2?.edges || [];
}

function edgeToSignal(edge, query) {
    const node    = edge.node;
    const budget  = node.budget;
    const budgetStr = budget?.amount
        ? `${budget.type === 'fixed' ? 'Fixed' : 'Hourly'}: ${budget.currency?.code || '$'}${budget.amount}`
        : null;

    const skills = (node.skills || []).map(s => s.name).join(', ');
    const text   = [
        node.title || '',
        budgetStr ? `Budget: ${budgetStr}` : '',
        skills ? `Skills: ${skills}` : '',
        (node.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    ].filter(Boolean).join('\n\n').substring(0, 1500);

    const clientInfo = node.client;
    const author = clientInfo?.totalReviews
        ? `Upwork Client (${clientInfo.totalReviews} reviews, ${clientInfo.totalPostedJobs || '?'} jobs posted)`
        : 'Upwork Client';

    return {
        id:        `upwork_${node.id}`,
        source:    'Upwork',
        text,
        url:       `https://www.upwork.com/jobs/~${node.id}`,
        author,
        posted_at: node.publishedDateTime || new Date().toISOString(),
    };
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchUpwork(sourceId, sourceConf, profile) {
    const cfg          = sourceConf?.config || {};
    const clientId     = process.env.UPWORK_CLIENT_ID;
    const clientSecret = process.env.UPWORK_CLIENT_SECRET;
    let   accessToken  = process.env.UPWORK_ACCESS_TOKEN;
    const refreshTok   = process.env.UPWORK_REFRESH_TOKEN;

    if (!accessToken && !refreshTok) {
        if (clientId) {
            console.warn('\n  Upwork: tokens not found — run: signal-hunter auth upwork');
        }
        // No credentials at all — silently skip
        return [];
    }

    const queries = cfg.search_queries || profile?.upwork_queries || [
        'react developer automation',
        'AI agent developer node',
    ];
    const limit   = Math.ceil((cfg.posts_per_scan || 20) / queries.length);

    const results = [];
    for (const query of queries.slice(0, 3)) {
        try {
            const edges = await searchJobs(accessToken, query, limit);
            results.push(...edges.map(e => edgeToSignal(e, query)));
        } catch (err) {
            if (err.message === 'UPWORK_TOKEN_EXPIRED' && refreshTok && clientId && clientSecret) {
                // Auto-refresh token
                try {
                    const tokens = await refreshToken(clientId, clientSecret, refreshTok);
                    accessToken  = tokens.access_token;
                    // Persist refreshed token
                    const { appendEnvKey } = await import('../utils/env-writer.js');
                    await appendEnvKey('UPWORK_ACCESS_TOKEN', accessToken);
                    if (tokens.refresh_token) await appendEnvKey('UPWORK_REFRESH_TOKEN', tokens.refresh_token);
                    // Retry
                    const edges = await searchJobs(accessToken, query, limit);
                    results.push(...edges.map(e => edgeToSignal(e, query)));
                } catch (refreshErr) {
                    console.warn(`\n  Upwork: token refresh failed — run: signal-hunter auth upwork`);
                }
            } else {
                console.warn(`\n  Upwork: ${err.message}`);
            }
        }
    }

    return results.slice(0, cfg.posts_per_scan || 20);
}
