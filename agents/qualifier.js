const TIMEOUT_MS  = 30_000;
const MAX_RETRIES = 1; // one retry on transient 429; daily quota won't recover anyway

// ── Pre-filter — zero-cost string check before any AI call ───────────────────
export function preFilter(signal, profile) {
    const text      = (signal.text || '').toLowerCase();
    const textStart = text.substring(0, 400); // header zone — most telling

    // 1. Red flag check — reject immediately
    for (const flag of (profile.services?.red_flags || [])) {
        if (text.includes(flag.toLowerCase())) {
            return { pass: false, reason: `red flag: "${flag}"` };
        }
    }

    // 2. Competitor filter — post is a JOB SEEKER (developer looking for work),
    //    not a CLIENT looking to hire. Saves AI calls on hundreds of "[FOR HIRE]" posts.
    const seekerSignals = [
        '[for hire]', '(for hire)', 'for hire:', 'available for hire',
        'looking for work', 'open to work', 'seeking opportunities', 'seeking projects',
        'hire me', 'my portfolio', 'available immediately', 'available for new projects',
        'dm for rates', 'dm me for rates', 'my rate is', 'my hourly rate',
        'i am a freelance', "i'm a freelance", 'i am available', "i'm available",
        'i am a full stack', "i'm a full stack", 'my skills include',
        'years of experience working', 'check out my portfolio', 'my github profile',
        'i specialize in', 'my services include', 'i offer services',
        'taking on new clients', 'currently available',
    ];
    for (const phrase of seekerSignals) {
        if (textStart.includes(phrase)) {
            return { pass: false, reason: `job seeker post: "${phrase}"` };
        }
    }

    // 3. Very short posts — not enough context to keyword-filter reliably
    if (text.split(/\s+/).length < 15) return { pass: true };

    // 4. Keyword overlap — profile keywords + universal buying-intent words
    const keywordSource = [
        profile.services?.what_you_do || '',
        profile.services?.buying_signals || '',
    ].join(' ');

    const profileKeywords = keywordSource
        .toLowerCase()
        .split(/[\s,.\n!?;:]+/)
        .filter(w => w.length > 4)
        .slice(0, 40);

    const intentKeywords = [
        'hire', 'hiring', 'looking for', 'need help', 'need a', 'need someone',
        'budget', 'contractor', 'freelancer', 'freelance', 'developer', 'agency',
        'build', 'integrate', 'automate', 'connect', 'implement', 'deploy',
        'help me', 'who can', 'recommend', 'anyone built', 'anyone know',
        'urgent', 'asap', 'project', 'payment', 'rate', 'quote', 'proposal',
        'struggling with', 'our team needs', 'we need', 'we are looking',
        'our company', 'startup', 'mvp', 'api', 'bot', 'workflow', 'automation',
    ];

    const allKeywords = [...profileKeywords, ...intentKeywords];
    if (!allKeywords.some(kw => text.includes(kw))) {
        return { pass: false, reason: 'no keyword overlap with profile' };
    }

    return { pass: true };
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(signal, profile, businesses, learningContext) {
    const bizSection = businesses?.length
        ? `\nPARTNER BUSINESSES — route to the best match:\n` +
          businesses.map(b =>
              `  id: ${b.id}\n  name: ${b.name}\n` +
              `  services: ${(b.services || []).join(', ')}\n` +
              `  buying signals: ${(b.buying_signals || []).join(', ')}`
          ).join('\n\n')
        : '';

    const learnSection = learningContext ? `\n${learningContext}\n` : '';

    return `You are a buying signal detector for a freelance software engineer. Score this internet post.

FREELANCER PROFILE:
Services: ${profile.services.what_you_do}
Ideal client signals: ${profile.services.buying_signals}
Red flags — reject if any present: ${(profile.services.red_flags || []).join(', ') || 'none'}
Minimum budget: ${profile.services.budget_min || '$200'}
${bizSection}${learnSection}

SIGNAL:
Source: ${signal.source}
Author: ${signal.author}
URL: ${signal.url}
Content:
"""
${signal.text}
"""

SCORING RUBRIC (be strict — most posts are discussions, not client leads):
90-100 → HIRE INTENT: explicitly looking to hire/contract a developer, budget mentioned, clear scope
         Examples: "Looking for React dev, budget $1500", "Need contractor for 3-week project"
70-89  → STRONG LEAD: strong buying intent, may not say "hire" explicitly but clearly needs paid help
         Examples: "Anyone build this for me?", "Need someone to set this up", custom API/bot/automation needed
50-69  → POSSIBLE LEAD: pain point clearly stated, might hire if approached right
         Examples: "Struggling with X workflow", company problem, startup founder asking how to build Y
30-49  → WEAK: general question, want to DIY, or very vague
         Examples: "How do I do X?", "What tool should I use?", "Has anyone tried Y?"
0-29   → NO LEAD: full-time employment, student question, pure discussion, large enterprise post

FREELANCE PLATFORM BONUS:
- Posts from Remotive = pre-filtered contract/freelance only — start score at 65+
- Posts from RemoteOK = pre-filtered to remove full-time — start score at 60+
- Posts from r/forhire, r/freelance_forhire, r/for_hire, r/hiring = likely paid work, start score at 60+
- HackerNews "Who is Hiring?" = real jobs, score based on fit

CRITICAL SCORING RULES:
- "How do I..." or "What is..." with no budget/hire intent → max score 35
- Person asking community for free advice → max score 40
- Full-time job at a company (not freelance) → max score 25
- Urgency words (urgent, asap, deadline, tonight, this week) → add 10 points
- Budget explicitly mentioned → add 15 points
- Small team / solo founder / startup → add 10 points (easier to close)

IMPORTANT — is_red_flag rules (strict):
- Set is_red_flag TRUE only if the content EXPLICITLY contains one of these: ${(profile.services.red_flags || []).join(', ')}
- Full-time job ads are NOT red flags — just score 0-25

OUTREACH_ANGLE must be a ready-to-send 2-3 sentence message:
- Start with what specifically caught your eye in THEIR post
- Connect it to a result you can deliver (not just "I can help")
- End with a low-friction next step ("Want me to sketch the architecture?" / "Happy to do a free 15-min scope call")
- Tone: peer-to-peer, not salesy. Be specific about their exact problem.

Return ONLY valid JSON — no markdown, no extra text:
{
  "score": 0,
  "is_red_flag": false,
  "business_match": ${businesses?.length ? '"matching business id or null"' : 'null'},
  "reasoning": "one sentence why this score — be specific about what hiring signal (or lack of) drove this",
  "budget_hint": "extracted budget/rate info or null",
  "urgency": "urgent|normal|low",
  "action": "dm|comment|apply|skip",
  "outreach_angle": "ready-to-send 2-3 sentence opener specific to this post"
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
export async function qualify(signal, profile, businesses, learningContext = null) {
    const provider = profile.llm?.provider || 'gemini';
    const model    = profile.llm?.model    || 'gemini-flash-latest';
    const prompt   = buildPrompt(signal, profile, businesses, learningContext);

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
