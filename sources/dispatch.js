// Source dispatcher — routes each source config entry to the right provider.
// Inspired by openclaw's provider plugin system.
//
// The `type` field in sources.yml determines the handler.
// If `type` is omitted, it defaults to the source's key name.
// This lets users add any number of rss/json_api/jina sources without code changes.
//
// Built-in types (fixed implementations):
//   hackernews, reddit, remoteok, remotive, devto, upwork, freelancer, twitter
//
// Generic types (fully configured in sources.yml):
//   rss      — any RSS/Atom feed (Upwork RSS, WeWorkRemotely, any job board)
//   json_api — any JSON API endpoint with configurable field mapping
//   jina     — any webpage via Jina.ai reader (custom_url is an alias)
//   websearch — Brave Search or Serper.dev with custom queries

import { fetchHackerNews }  from './hackernews.js';
import { fetchReddit }      from './reddit.js';
import { fetchRemoteOk }    from './remoteok.js';
import { fetchRemotive }    from './remotive.js';
import { fetchDevTo }       from './devto.js';
import { fetchUpwork }      from './upwork.js';
import { fetchFreelancer }  from './freelancer.js';
import { fetchTwitter }     from './twitter.js';
import { fetchWebSearch }   from './websearch.js';
import { fetchCustomUrl }   from './custom.js';
import { fetchRss }         from './providers/rss.js';
import { fetchJsonApi }     from './providers/json_api.js';

// ── Type registry ─────────────────────────────────────────────────────────────
// Each handler: (sourceId, sourceConf, profile, globalSourcesConfig) => Promise<Signal[]>
const TYPE_REGISTRY = {
    // Built-in named sources
    hackernews:  (id, conf, profile, cfg) => fetchHackerNews(profile, conf.config || cfg),
    reddit:      (id, conf, profile, cfg) => fetchReddit(profile, conf.config || cfg),
    remoteok:    (id, conf, profile, cfg) => fetchRemoteOk(profile, conf.config || cfg),
    remotive:    (id, conf, profile, cfg) => fetchRemotive(profile, conf.config || cfg),
    devto:       (id, conf, profile, cfg) => fetchDevTo(profile, conf.config || cfg),
    upwork:      (id, conf, profile, cfg) => fetchUpwork(id, conf, profile),
    freelancer:  (id, conf, profile, cfg) => fetchFreelancer(profile, conf.config || cfg),
    twitter:     (id, conf, profile, cfg) => fetchTwitter(profile, conf.config || cfg),
    websearch:   (id, conf, profile, cfg) => fetchWebSearch(profile, conf.config || cfg),

    // Generic user-configurable types
    rss:         (id, conf, profile, cfg) => fetchRss(id, conf),
    json_api:    (id, conf, profile, cfg) => fetchJsonApi(id, conf),
    jina:        (id, conf, profile, cfg) => fetchCustomUrl(conf.config || {}),
    custom_url:  (id, conf, profile, cfg) => fetchCustomUrl(conf.config || {}),
    custom:      (id, conf, profile, cfg) => {
        // Legacy: custom means iterating custom_urls list from global sourcesConfig
        const urls = (cfg?.custom_urls?.urls || conf.config?.urls || []);
        return Promise.all(urls.map(u => fetchCustomUrl(u))).then(a => a.flat());
    },
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Dispatch a single source entry to its provider.
 * @param {string} sourceId - key from sources.yml (e.g. "reddit", "my_rss")
 * @param {object} sourceConf - the value under that key in sources.yml
 * @param {object} profile - loaded profile.yml
 * @param {object} globalSrcCfg - full sources.yml parsed object
 */
export async function dispatchSource(sourceId, sourceConf, profile, globalSrcCfg) {
    const type    = sourceConf.type || sourceId;
    const handler = TYPE_REGISTRY[type];

    if (!handler) {
        console.warn(`\n  Unknown source type "${type}" (source: "${sourceId}") — skipping`);
        return [];
    }

    return handler(sourceId, sourceConf, profile, globalSrcCfg);
}

/** Returns all registered type names for help text / doctor checks. */
export function listTypes() {
    return Object.keys(TYPE_REGISTRY);
}
