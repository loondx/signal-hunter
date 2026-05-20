// Generic JSON API provider — maps any JSON endpoint to signals.
// Configured entirely from sources.yml, no code changes needed.
//
// sources.yml config options:
//   url: "https://api.example.com/jobs"
//   url_env: "MY_API_URL"                         # read URL from env var
//   auth_header_name: "Authorization"              # header name for auth
//   auth_header_value: "Bearer ${MY_API_KEY}"      # supports ${ENV_VAR} interpolation
//   auth_header_env: "MY_API_KEY"                  # shorthand: adds "Authorization: Bearer <value>"
//   custom_header_name: "X-API-Key"
//   custom_header_env: "MY_API_KEY"
//   response_path: "result.projects"               # dot-path to array in response
//   id_field: "id"
//   text_fields: ["title", "description"]           # concatenated into text
//   url_field: "url"
//   url_template: "https://example.com/jobs/{id}"  # {field} interpolation
//   author_field: "company"
//   date_field: "published_at"
//   date_unix: true                                 # if date is a Unix timestamp
//   label: "My API"
//   posts_per_scan: 20
//   extra_params:                                   # appended to URL as query params
//     limit: 20
//     category: "software-dev"

const UA = 'signal-hunter/0.5.0 (+https://github.com/loondx/signal-hunter)';

function getPath(obj, path) {
    if (!path || path === '.') return obj;
    return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

function interpolate(template, obj) {
    return template.replace(/\{([^}]+)\}/g, (_, k) => {
        const v = getPath(obj, k);
        return v != null ? String(v) : '';
    });
}

function resolveEnv(s) {
    return (s || '').replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || '');
}

function buildText(item, fields) {
    return fields
        .map(f => {
            const v = getPath(item, f);
            if (v == null || v === '') return '';
            const s = typeof v === 'string' ? v : String(v);
            return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean)
        .join('\n\n')
        .substring(0, 1500);
}

function slugHash(s) {
    let h = 5381;
    for (let i = 0; i < Math.min(String(s).length, 80); i++) { h = ((h << 5) + h) + String(s).charCodeAt(i); h |= 0; }
    return Math.abs(h).toString(36);
}

export async function fetchJsonApi(sourceId, sourceConf) {
    const cfg   = sourceConf.config || {};
    const label = cfg.label || sourceId;
    const limit = cfg.posts_per_scan || 20;

    // Resolve URL
    let url = cfg.url ? resolveEnv(cfg.url) : '';
    if (!url && cfg.url_env) {
        url = process.env[cfg.url_env] || '';
        if (!url) { console.warn(`\n  ${label}: ${cfg.url_env} not set in .env — skipping`); return []; }
    }
    if (!url) return [];

    // Append extra query params
    if (cfg.extra_params) {
        const base = new URL(url);
        for (const [k, v] of Object.entries(cfg.extra_params)) base.searchParams.set(k, String(v));
        url = base.toString();
    }

    // Build headers
    const headers = { 'User-Agent': UA, 'Accept': 'application/json' };
    if (cfg.auth_header_env) {
        const v = process.env[cfg.auth_header_env];
        if (v) headers[cfg.auth_header_name || 'Authorization'] = `Bearer ${v}`;
    }
    if (cfg.custom_header_name && cfg.custom_header_env) {
        const v = process.env[cfg.custom_header_env];
        if (v) headers[cfg.custom_header_name] = v;
    }
    if (cfg.auth_header_name && cfg.auth_header_value) {
        headers[cfg.auth_header_name] = resolveEnv(cfg.auth_header_value);
    }

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
        const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal });
        clearTimeout(timer);
        if (res.status === 401 || res.status === 403) {
            console.warn(`\n  ${label}: auth failed (${res.status}) — check credentials in .env`);
            return [];
        }
        if (!res.ok) return [];
        const json  = await res.json();
        const items = getPath(json, cfg.response_path);
        if (!Array.isArray(items)) { console.warn(`\n  ${label}: response_path "${cfg.response_path}" did not yield an array`); return []; }

        const textFields  = cfg.text_fields || ['title', 'description'];
        const idField     = cfg.id_field    || 'id';
        const urlField    = cfg.url_field   || 'url';
        const urlTemplate = cfg.url_template || '';
        const authorField = cfg.author_field || '';
        const dateField   = cfg.date_field  || '';
        const dateUnix    = !!cfg.date_unix;

        return items.slice(0, limit).map(item => {
            const rawId  = getPath(item, idField);
            const rawUrl = urlTemplate ? interpolate(urlTemplate, item) : getPath(item, urlField) || '';
            const rawDate = dateField ? getPath(item, dateField) : '';
            const isoDate = rawDate
                ? (dateUnix ? new Date(rawDate * 1000).toISOString() : new Date(rawDate).toISOString())
                : new Date().toISOString();

            return {
                id:        `json_${sourceId}_${slugHash(String(rawId || rawUrl))}`,
                source:    label,
                text:      buildText(item, textFields),
                url:       String(rawUrl).startsWith('http') ? String(rawUrl) : '',
                author:    authorField ? String(getPath(item, authorField) || label) : label,
                posted_at: isoDate,
            };
        }).filter(r => r.url && r.text.length > 30);

    } catch (err) {
        clearTimeout(timer);
        if (err.name !== 'AbortError') console.warn(`\n  ${label}: fetch failed — ${err.message}`);
        return [];
    }
}
