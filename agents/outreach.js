// End-to-end outreach generator — called when user runs `signal-hunter reply N`.
// Uses AI to generate a complete, send-ready outreach package:
// - full personalized first message (not just an angle)
// - platform-specific send instructions
// - follow-up message for day 3-4
// - scope clarification questions
// - proposal opening line
//
// Uses the same LLM provider as the qualifier (from profile.yml).

const TIMEOUT_MS = 30_000;

function buildOutreachPrompt(signal, profile) {
    const platform = detectPlatform(signal.source, signal.url);

    return `You are a senior freelance business development expert. Generate a complete outreach package for this lead.

FREELANCER PROFILE:
Name: ${profile.identity?.name || 'Pankaj'}
Services: ${profile.services.what_you_do}
Budget minimum: ${profile.services.budget_min || '$300'}

THE LEAD:
Source: ${signal.source}
URL: ${signal.url}
Author: ${signal.author}
Score: ${signal.score}/100  |  Urgency: ${signal.urgency}
Budget mentioned: ${signal.budget_hint || 'not specified'}
AI Reasoning: ${signal.reasoning || ''}

Their post:
"""
${(signal.text || '').substring(0, 800)}
"""

PLATFORM: ${platform.type} (${platform.instruction})

OUTREACH RULES:
- Open with THEIR specific problem or situation (not "Hi, I saw your post")
- Reference at least one concrete detail from their post
- Connect to a real result you can deliver (not just "I can help")
- Under 120 words for the main message — brevity wins
- Peer-to-peer tone — not salesy, not desperate
- End with ONE specific next step: offer to sketch architecture / share a related project / ask one targeted question
- Do NOT start with "Hi [author]" — start with a sentence about their problem

Return ONLY valid JSON (no markdown):
{
  "platform": "${platform.type}",
  "how_to_send": "Exact steps to send this — where to click, what platform section to use",
  "message": "Complete first message — copy-paste ready, under 120 words",
  "subject": "Email subject line if needed, null otherwise",
  "followup_day4": "Follow-up message to send day 3-4 if no response (under 60 words, different angle)",
  "proposal_opener": "Opening sentence for a formal proposal if they respond positively (1 sentence)",
  "scope_questions": ["Most important question to clarify scope or budget", "Second question if needed"],
  "why_you_win": "The single strongest reason you should win this project (1 sentence, specific)"
}`;
}

function detectPlatform(source, url) {
    if (/reddit/i.test(source) || /reddit\.com/i.test(url)) {
        return {
            type: 'reddit',
            instruction: 'reply to their post as a comment, or send a Reddit DM if they say "DM me"',
        };
    }
    if (/hacker news/i.test(source) || /ycombinator\.com/i.test(url)) {
        return {
            type: 'hackernews',
            instruction: 'reply directly as a comment on the HN thread — HN culture prefers concise technical replies',
        };
    }
    if (/dev\.to/i.test(source) || /dev\.to/i.test(url)) {
        return {
            type: 'devto',
            instruction: 'post a comment on the article or use the "Contact" link on their profile',
        };
    }
    if (/remot/i.test(source) || /remoteok|remotive/i.test(url)) {
        return {
            type: 'job_application',
            instruction: 'apply via the "Apply" button on the job listing — include your message as the cover letter',
        };
    }
    if (/linkedin/i.test(url)) {
        return {
            type: 'linkedin_dm',
            instruction: 'send a LinkedIn connection request with a note, or use InMail if not connected',
        };
    }
    return {
        type: 'direct',
        instruction: 'open the URL and use their preferred contact method (email, form, or DM)',
    };
}

// ── LLM callers (re-used from qualifier pattern) ──────────────────────────────

async function callGemini(prompt, model) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const m = new GoogleGenerativeAI(key).getGenerativeModel({ model });
    const timeout = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), TIMEOUT_MS));
    const result = await Promise.race([m.generateContent(prompt), timeout]);
    return result.response.text();
}

async function callOpenAI(prompt, model) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.3 }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    return (await res.json()).choices[0].message.content;
}

async function callClaude(prompt, model) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not set');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    return (await res.json()).content[0].text;
}

async function callOllama(prompt, model) {
    const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const res = await fetch(`${base}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    return (await res.json()).response;
}

function parseJson(raw) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return JSON.parse(match[0]);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateOutreach(signal, profile) {
    const provider = profile.llm?.provider || 'gemini';
    const model    = profile.llm?.model    || 'gemini-flash-latest';
    const prompt   = buildOutreachPrompt(signal, profile);

    try {
        let raw;
        if      (provider === 'gemini') raw = await callGemini(prompt, model);
        else if (provider === 'openai') raw = await callOpenAI(prompt, model);
        else if (provider === 'claude') raw = await callClaude(prompt, model);
        else if (provider === 'ollama') raw = await callOllama(prompt, model);
        else throw new Error(`Unknown provider: ${provider}`);

        return parseJson(raw);
    } catch (err) {
        return {
            platform:        detectPlatform(signal.source, signal.url).type,
            how_to_send:     'Open the signal URL and reply directly.',
            message:         signal.outreach_angle || '(outreach generation failed — use the angle above)',
            subject:         null,
            followup_day4:   'Following up on my earlier message — still happy to help if the project is still open.',
            proposal_opener: 'Based on our conversation, here\'s a rough scope and timeline:',
            scope_questions: ['What\'s your timeline?', 'What\'s the budget range?'],
            why_you_win:     'Directly relevant experience with this type of project.',
            error:           err.message,
        };
    }
}
