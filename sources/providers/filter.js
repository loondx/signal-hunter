// Keyword pre-filter shared by the generic providers (rss, json_api).
// Drops obvious non-matches before AI qualification — saves LLM calls
// and keeps full-time-heavy job boards useful for contract hunting.
//
// sources.yml config options (both optional, case-insensitive substring match):
//   include_keywords: [contract, freelance]     # keep only items containing ANY
//   exclude_keywords: [internship, unpaid]      # drop items containing ANY

export function keywordFilter(items, cfg) {
    const inc = (cfg.include_keywords || []).map((k) => String(k).toLowerCase());
    const exc = (cfg.exclude_keywords || []).map((k) => String(k).toLowerCase());
    if (!inc.length && !exc.length) return items;

    return items.filter(({ text }) => {
        const t = (text || '').toLowerCase();
        if (exc.some((k) => t.includes(k))) return false;
        if (inc.length && !inc.some((k) => t.includes(k))) return false;
        return true;
    });
}
