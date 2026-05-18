const TIMEOUT_MS  = 30_000;
const MAX_RETRIES = 1; // one retry on transient 429; daily quota won't recover anyway

// ── Pre-filter — zero-cost string check before any AI call ───────────────────
export function preFilter(signal, profile) {
    const text = (signal.text || '').toLowerCase();

    // 1. Red flag check — immediate reject
    for (const flag of (profile.services?.red_flags || [])) {
        if (text.includes(flag.toLowerCase())) {
            return { pass: false, reason: `red flag: "${flag}"` };
        }
    }

    // 2. Very short posts — not enough context to keyword-filter reliably
    if (text.split(/\s+/).length < 15) return { pass: true };

    // 3. Keyword overlap with profile services
    const keywordSource = [
        profile.services?.what_you_do || '',
        profile.services?.buying_signals || '',
    ].join(' ');

    const keywords = keywordSource
        .toLowerCase()
        .split(/[\s,.\n!?;:]+/)
        .filter(w => w.length > 4)
        .slice(0, 40);

    if (keywords.length === 0) return { pass: true };

    if (!keywords.some(kw => text.includes(kw))) {
        return { pass: false, reason: 'no keyword overlap with profile' };
    }

    return { pass: true };
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(signal, profile, businesses) {
    const bizSection = businesses?.length
        ? `\nPARTNER BUSINESSES — route to the best match:\n` +
          businesses.map(b =>
              `  id: ${b.id}\n  name: ${b.name}\n` +
              `  services: ${(b.services || []).join(', ')}\n` +
              `  buying signals: ${(b.buying_signals || []).join(', ')}`
          ).join('\n\n')
        : '';

    return `You are a buying signal detector for service businesses. Analyze this internet post and score it.

PRIMARY BUSINESS:
What they offer: ${profile.services.what_you_do}
Ideal client signals: ${profile.services.buying_signals}
Red flags — reject if any present: ${(profile.services.red_flags || []).join(', ') || 'none'}
Minimum budget: ${profile.services.budget_min || 'not specified'}
${bizSection}

SIGNAL:
Source: ${signal.source}
Author: ${signal.author}
URL: ${signal.url}
Content:
"""
${signal.text}
"""

Score 0-100:
90-100 → urgent buying intent, clear fit, respond today
70-89  → strong signal, good fit, respond soon
50-69  → moderate fit, worth a look
30-49  → weak or unclear signal
0-29   → not relevant or red flag

Return ONLY valid JSON — no markdown, no extra text:
{
  "score": 0,
  "is_red_flag": false,
  "business_match": ${businesses?.length ? '"matching business id or null"' : 'null'},
  "reasoning": "one sentence why this score",
  "budget_hint": "extracted budget info or null",
  "urgency": "urgent|normal|low",
  "outreach_angle": "2-3 sentences: how to open this specific conversation"
}`;
}

// ── Retry-after parser — reads delay from 429 error messages ─────────────────
function parseRetryAfter(errMsg) {
    const match = errMsg?.match(/retry[^\d]*([\d.]+)\s*s/i);
    if (match) return Math.ceil(parseFloat(match[1])) * 1000 + 500;
    return 60_000; // fallback: wait 1 minute
}

// ── Gemini (with 429 retry + backoff) ────────────────────────────────────────
async function callGemini(prompt, model) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set in .env');

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(key);
    const m     = genAI.getGenerativeModel({ model });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const timeout = new Promise((_, rej) =>
                setTimeout(() => rej(new Error('Gemini timeout (30s)')), TIMEOUT_MS)
            );
            const result = await Promise.race([m.generateContent(prompt), timeout]);
            return result.response.text();
        } catch (err) {
            const is429 = err.message?.includes('429') || err.message?.includes('Too Many Requests');
            if (is429 && attempt < MAX_RETRIES) {
                const delay = parseRetryAfter(err.message);
                console.warn(`\n  [rate limit] Gemini quota hit — waiting ${Math.round(delay / 1000)}s before retry...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw err;
        }
    }
}

// ── OpenAI ────────────────────────────────────────────────────────────────────
async function callOpenAI(prompt, model) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set in .env');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0.1 }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    return (await res.json()).choices[0].message.content;
}

// ── Anthropic Claude ──────────────────────────────────────────────────────────
async function callClaude(prompt, model) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not set in .env');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model, max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    return (await res.json()).content[0].text;
}

// ── Ollama (local) ────────────────────────────────────────────────────────────
async function callOllama(prompt, model) {
    const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const res = await fetch(`${base}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model, prompt, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    return (await res.json()).response;
}

// ── JSON extractor ────────────────────────────────────────────────────────────
function parseJson(raw) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in LLM response');
    return JSON.parse(match[0]);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function qualify(signal, profile, businesses) {
    const provider = profile.llm?.provider || 'gemini';
    const model    = profile.llm?.model    || 'gemini-flash-latest';
    const prompt   = buildPrompt(signal, profile, businesses);

    try {
        let raw;
        if      (provider === 'gemini') raw = await callGemini(prompt, model);
        else if (provider === 'openai') raw = await callOpenAI(prompt, model);
        else if (provider === 'claude') raw = await callClaude(prompt, model);
        else if (provider === 'ollama') raw = await callOllama(prompt, model);
        else throw new Error(`Unknown LLM provider: ${provider}`);

        return parseJson(raw);
    } catch (err) {
        return {
            score:          0,
            is_red_flag:    false,
            business_match: null,
            reasoning:      `AI unavailable: ${err.message.split('\n')[0]}`,
            budget_hint:    null,
            urgency:        'low',
            outreach_angle: '',
        };
    }
}
