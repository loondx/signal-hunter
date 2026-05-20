#!/usr/bin/env node
import * as p from '@clack/prompts';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dump } from 'js-yaml';
import pc from 'picocolors';
import { join } from 'path';
import { DATA_DIR } from '../../utils/paths.js';

function onCancel() {
    p.cancel('Setup cancelled. Run `signal-hunter setup` whenever you\'re ready.');
    process.exit(0);
}
function guard(value) {
    if (p.isCancel(value)) onCancel();
    return value;
}

// Pre-populate from existing .env on re-runs
if (existsSync(join(DATA_DIR, '.env'))) {
    for (const line of readFileSync(join(DATA_DIR, '.env'), 'utf8').split('\n')) {
        const [key, ...rest] = line.split('=');
        if (key && !key.startsWith('#') && rest.length) process.env[key.trim()] ??= rest.join('=').trim();
    }
}

console.log('');
p.intro(pc.bgCyan(pc.black('  Signal Hunter — Setup  ')));

if (existsSync(join(DATA_DIR, 'config/profile.yml'))) {
    const overwrite = guard(await p.confirm({
        message: 'A profile already exists. Overwrite it?',
        initialValue: false,
    }));
    if (!overwrite) { p.outro('Setup skipped — your existing config is unchanged.'); process.exit(0); }
}

p.note(
    'Takes ~3 minutes.\nEverything stays on your machine — nothing is sent anywhere.',
    'Getting started'
);

// ── Step 1: Identity ──────────────────────────────────────────────────────────
const identity = await p.group({
    name: () => p.text({
        message: 'Your name or company name:',
        placeholder: 'Pankaj / Loondx',
        validate: (v) => !v?.trim() ? 'Required' : undefined,
    }),
    email: () => p.text({
        message: 'Your email (for notifications):',
        placeholder: 'you@example.com',
    }),
    type: () => p.select({
        message: 'What best describes you?',
        options: [
            { value: 'freelancer', label: 'Freelancer',     hint: 'solo contractor' },
            { value: 'agency',     label: 'Small agency',   hint: 'service business with a team' },
            { value: 'both',       label: 'Both',           hint: 'I freelance + have partner businesses' },
        ],
    }),
}, { onCancel });

// ── Step 2: Services ──────────────────────────────────────────────────────────
p.note(
    'Tell the AI what to look for.\nDescribe the PAIN your clients have — not just your skills.',
    'Step 2 of 6 — Your Services'
);

const services = await p.group({
    what_you_do: () => p.text({
        message: 'What do you build / offer? (one line)',
        placeholder: 'React apps, n8n automation, AI agents, Discord bots for small businesses',
        validate: (v) => !v?.trim() ? 'Required' : undefined,
    }),
    buying_signals: () => p.text({
        message: 'What problems do your clients have?',
        placeholder: 'Manual workflows, need a bot, want AI integrated, building MVP, need API connected',
        validate: (v) => !v?.trim() ? 'Required' : undefined,
    }),
    red_flags: () => p.text({
        message: 'What should the AI skip? (comma-separated)',
        placeholder: 'equity only, gambling, adult content, homework, crypto token',
    }),
    budget_min: () => p.text({
        message: 'Minimum project budget? (filters low-value signals)',
        placeholder: '$300',
    }),
}, { onCancel });

// ── Step 3: Sources — Free ────────────────────────────────────────────────────
p.note(
    'Free sources — no credentials needed.\nMore sources = more leads, but also more noise.',
    'Step 3 of 6 — Free Sources'
);

const freeSources = guard(await p.multiselect({
    message: 'Select free sources to monitor:',
    options: [
        { value: 'hackernews', label: 'Hacker News',  hint: '"Who is Hiring?" + discussions · free · no auth',      selected: true  },
        { value: 'reddit',     label: 'Reddit',       hint: 'r/forhire, r/freelance + custom subs · free · no auth', selected: true  },
        { value: 'remoteok',   label: 'Remote OK',    hint: 'remote job board · free open API',                      selected: true  },
        { value: 'remotive',   label: 'Remotive',     hint: 'curated remote jobs · free API',                        selected: true  },
        { value: 'devto',      label: 'Dev.to',       hint: '#hiring #webdev #automation · free API · no auth',      selected: true  },
        { value: 'custom',     label: 'Custom URLs',  hint: 'any webpage via Jina.ai reader · free · no auth',       selected: false },
        { value: 'twitter',    label: 'Twitter / X',  hint: 'requires TWITTER_BEARER_TOKEN in .env',                 selected: false },
    ],
    required: true,
}));

// Reddit subreddits
let redditSubs = 'forhire,freelance_forhire,for_hire,hiring,DeveloperJobs,startups,SaaS,Entrepreneur,n8n,automation,nocode,webdev,reactjs';
if (freeSources.includes('reddit')) {
    const subs = guard(await p.text({
        message: 'Subreddits to watch? (comma-separated, no "r/")',
        placeholder: 'forhire,freelance_forhire,for_hire,hiring,startups,n8n,automation,webdev',
        initialValue: redditSubs,
    }));
    redditSubs = subs || redditSubs;
}

// ── Step 4: Premium Sources ───────────────────────────────────────────────────
p.note(
    'Premium platforms have higher-quality leads with real budgets.\nEach requires credentials — skip any you don\'t use.',
    'Step 4 of 6 — Premium Sources (Optional)'
);

const premiumSources = guard(await p.multiselect({
    message: 'Connect premium job platforms: (space to select, enter to skip all)',
    options: [
        { value: 'upwork',         label: 'Upwork',         hint: 'biggest freelance platform · needs your RSS URL',         selected: false },
        { value: 'freelancer',     label: 'Freelancer.com', hint: 'active project marketplace · optional OAuth token',       selected: false },
        { value: 'peopleperhour',  label: 'PeoplePerHour',  hint: 'UK/EU clients · no auth needed',                          selected: false },
        { value: 'websearch',      label: 'Web Search',     hint: 'searches entire internet · needs free Brave/Serper key',  selected: false },
    ],
}));

const envLines = [
    '# Signal Hunter — API Keys',
    '# DO NOT commit this file to git (it is in .gitignore)',
    '',
];
const premiumSourcesEnabled = [];

// Upwork
if (premiumSources.includes('upwork')) {
    const existing = process.env.UPWORK_RSS_URL;
    let upworkUrl = existing || '';
    if (!existing) {
        p.note(
            [
                '1. Log in to Upwork at upwork.com',
                '2. Go to "Find Work" → search for your skills',
                '3. Look for the RSS link or go to:',
                '   https://www.upwork.com/ab/feed/jobs/rss?q=YOUR+SKILLS',
                '4. Copy the full URL from your browser (it has your security token)',
            ].join('\n'),
            'Getting your Upwork RSS URL'
        );
        const url = guard(await p.text({
            message: 'Paste your Upwork RSS URL:',
            placeholder: 'https://www.upwork.com/ab/feed/jobs/rss?q=...&securityToken=...',
            validate: (v) => {
                if (!v?.trim()) return 'Required — or press Ctrl+C to skip Upwork';
                if (!v.includes('upwork.com')) return 'Must be an Upwork URL';
            },
        }));
        upworkUrl = url;
    }
    if (upworkUrl) {
        envLines.push(`UPWORK_RSS_URL=${upworkUrl}`);
        premiumSourcesEnabled.push('upwork');
    }
}

// Freelancer.com
if (premiumSources.includes('freelancer')) {
    const existing = process.env.FREELANCER_OAUTH_TOKEN;
    if (existing) {
        premiumSourcesEnabled.push('freelancer');
        envLines.push(`FREELANCER_OAUTH_TOKEN=${existing}`);
    } else {
        p.note(
            [
                'Freelancer.com works without a token (limited data).',
                'For better results, get a free token:',
                '  https://developers.freelancer.com → Create App → OAuth Token',
            ].join('\n'),
            'Freelancer.com (optional token)'
        );
        const addToken = guard(await p.confirm({
            message: 'Do you have a Freelancer.com OAuth token to add?',
            initialValue: false,
        }));
        if (addToken) {
            const token = guard(await p.password({
                message: 'Paste your Freelancer.com token:',
            }));
            if (token?.trim()) envLines.push(`FREELANCER_OAUTH_TOKEN=${token.trim()}`);
        }
        premiumSourcesEnabled.push('freelancer');
    }
}

// PeoplePerHour — no auth
if (premiumSources.includes('peopleperhour')) {
    premiumSourcesEnabled.push('peopleperhour');
}

// Web Search
if (premiumSources.includes('websearch')) {
    const existingBrave  = process.env.BRAVE_SEARCH_API_KEY;
    const existingSerper = process.env.SERPER_API_KEY;
    if (existingBrave || existingSerper) {
        if (existingBrave)  envLines.push(`BRAVE_SEARCH_API_KEY=${existingBrave}`);
        if (existingSerper) envLines.push(`SERPER_API_KEY=${existingSerper}`);
        premiumSourcesEnabled.push('websearch');
    } else {
        const engine = guard(await p.select({
            message: 'Web search provider (both are free):',
            options: [
                { value: 'brave',  label: 'Brave Search',  hint: 'free 2000 queries/month · https://api.search.brave.com' },
                { value: 'serper', label: 'Serper.dev',    hint: 'free 2500 queries/month (Google results) · https://serper.dev' },
            ],
        }));
        const keyName = engine === 'brave' ? 'BRAVE_SEARCH_API_KEY' : 'SERPER_API_KEY';
        const keyHint = engine === 'brave' ? 'api.search.brave.com → API Keys' : 'serper.dev → Dashboard → API Key';
        const key = guard(await p.password({
            message: `Paste your ${engine === 'brave' ? 'Brave' : 'Serper'} API key  ${pc.dim('(' + keyHint + ')')}:`,
            validate: (v) => !v?.trim() ? 'Required — or Ctrl+C to skip web search' : undefined,
        }));
        if (key?.trim()) {
            envLines.push(`${keyName}=${key.trim()}`);
            premiumSourcesEnabled.push('websearch');
        }
    }
}

// ── Step 5: AI Brain ──────────────────────────────────────────────────────────
p.note(
    'Signal Hunter uses an LLM to understand intent — not just keyword matching.\nGemini Flash is free and fast. Claude Haiku is more accurate.',
    'Step 5 of 6 — AI Brain'
);

const llmProvider = guard(await p.select({
    message: 'Which AI model to use for signal scoring?',
    options: [
        { value: 'gemini', label: 'Google Gemini Flash',    hint: 'free tier · fast · good for getting started' },
        { value: 'claude', label: 'Anthropic Claude Haiku', hint: 'paid · best accuracy for nuanced scoring' },
        { value: 'openai', label: 'OpenAI GPT-4o-mini',     hint: 'paid · fast and accurate' },
        { value: 'ollama', label: 'Ollama (local)',          hint: 'free · fully private · runs on your machine' },
    ],
}));

const LLM_MODELS = {
    gemini: 'gemini-flash-latest',
    openai: 'gpt-4o-mini',
    claude: 'claude-haiku-4-5-20251001',
    ollama: 'llama3.2',
};
const KEY_NAMES = { gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY', claude: 'ANTHROPIC_API_KEY', ollama: null };
const KEY_HINTS = {
    gemini: 'aistudio.google.com → Get API key (free)',
    openai: 'platform.openai.com/api-keys',
    claude: 'console.anthropic.com/settings/keys',
};

let apiKey = '';
const keyName = KEY_NAMES[llmProvider];
if (keyName) {
    const existing = process.env[keyName];
    if (existing?.length > 10) {
        const reuse = guard(await p.confirm({ message: `Found existing ${keyName}. Use it?`, initialValue: true }));
        if (reuse) apiKey = existing;
    }
    if (!apiKey) {
        apiKey = guard(await p.password({
            message: `Paste your ${keyName}  ${pc.dim('(' + KEY_HINTS[llmProvider] + ')')}:`,
            validate: (v) => !v?.trim() ? 'Required' : undefined,
        }));
    }
}

// ── Step 6: Notifications + Automation ───────────────────────────────────────
p.note(
    'Set up Discord alerts and choose how often to scan.\nYou can always change these later in config/profile.yml.',
    'Step 6 of 6 — Notifications & Automation'
);

const wantsDiscord = guard(await p.confirm({
    message: 'Send high-score signals to Discord?',
    initialValue: true,
}));

let discordWebhook = '';
if (wantsDiscord) {
    const existing = process.env.DISCORD_WEBHOOK_URL;
    if (existing?.startsWith('https://discord.com/api/webhooks/')) {
        const reuse = guard(await p.confirm({ message: 'Found existing Discord webhook. Use it?', initialValue: true }));
        if (reuse) discordWebhook = existing;
    }
    if (!discordWebhook) {
        discordWebhook = guard(await p.text({
            message: 'Discord webhook URL:',
            placeholder: 'https://discord.com/api/webhooks/...',
            hint: 'Discord channel → Edit Channel → Integrations → Webhooks → New',
            validate: (v) => {
                if (!v?.trim()) return 'Required';
                if (!v.includes('discord.com/api/webhooks/')) return 'Must be a Discord webhook URL';
            },
        }));
    }
}

const notifyScore = guard(await p.select({
    message: 'Minimum score to trigger a Discord ping:',
    options: [
        { value: 60, label: 'Score 60+', hint: 'more pings — catch everything' },
        { value: 65, label: 'Score 65+', hint: 'recommended — good balance' },
        { value: 70, label: 'Score 70+', hint: 'less noise — only strong leads' },
        { value: 80, label: 'Score 80+', hint: 'minimal pings — hot leads only' },
    ],
    initialValue: 65,
}));

// Cron interval — dynamic, stored in profile
const cronInterval = guard(await p.select({
    message: 'How often should Signal Hunter scan automatically?',
    options: [
        { value: '15m',  label: 'Every 15 minutes',  hint: 'best coverage · highest API usage' },
        { value: '30m',  label: 'Every 30 minutes',  hint: 'recommended — good balance' },
        { value: '1h',   label: 'Every hour',         hint: 'lower cost · slightly slower alerts' },
        { value: '2h',   label: 'Every 2 hours',      hint: 'minimal API usage' },
        { value: '6h',   label: 'Every 6 hours',      hint: 'twice daily' },
        { value: '12h',  label: 'Twice a day',        hint: 'morning + evening scan' },
        { value: '24h',  label: 'Once a day',         hint: 'daily digest' },
    ],
    initialValue: '30m',
}));

const minScore = guard(await p.select({
    message: 'Minimum AI score to save a signal to your pipeline:',
    options: [
        { value: 50, label: 'Score 50+', hint: 'save more — review manually' },
        { value: 55, label: 'Score 55+', hint: 'recommended' },
        { value: 60, label: 'Score 60+', hint: 'only solid leads' },
        { value: 70, label: 'Score 70+', hint: 'strict — high-confidence only' },
    ],
    initialValue: 55,
}));

// ── Write config files ────────────────────────────────────────────────────────
const s = p.spinner();
s.start('Writing configuration...');

mkdirSync(join(DATA_DIR, 'config'), { recursive: true });
mkdirSync(join(DATA_DIR, 'data'),   { recursive: true });
mkdirSync(join(DATA_DIR, 'logs'),   { recursive: true });

const allEnabled = [
    ...freeSources,
    ...premiumSourcesEnabled,
];

const profile = {
    version: '1',
    identity: {
        name:  identity.name.trim(),
        email: identity.email?.trim() || '',
        type:  identity.type,
    },
    services: {
        what_you_do:    services.what_you_do.trim(),
        buying_signals: services.buying_signals.trim(),
        red_flags: services.red_flags
            ? services.red_flags.split(',').map(v => v.trim()).filter(Boolean)
            : [],
        budget_min: services.budget_min?.trim() || '$300',
    },
    llm: {
        provider:  llmProvider,
        model:     LLM_MODELS[llmProvider],
        min_score: minScore,
    },
    sources: {
        enabled: allEnabled,
        reddit: {
            subreddits: redditSubs.split(',').map(v => v.trim().replace(/^r\//, '')).filter(Boolean),
        },
    },
    notifications: {
        discord_webhook:  discordWebhook || '',
        email:            identity.email?.trim() || '',
        notify_min_score: notifyScore,
    },
    automation: {
        cron_interval: cronInterval,
    },
};

writeFileSync(join(DATA_DIR, 'config/profile.yml'), dump(profile, { lineWidth: 120 }));

// Build .env
if (llmProvider !== 'ollama') envLines.push(`${keyName}=${apiKey}`);
if (llmProvider === 'ollama')  envLines.push('OLLAMA_BASE_URL=http://localhost:11434');
if (discordWebhook)            { envLines.push(''); envLines.push(`DISCORD_WEBHOOK_URL=${discordWebhook}`); }

writeFileSync(join(DATA_DIR, '.env'), envLines.join('\n') + '\n');

// Write data files if first setup
if (!existsSync(join(DATA_DIR, 'data/signals.md'))) {
    writeFileSync(join(DATA_DIR, 'data/signals.md'), [
        '# Signal Pipeline', '',
        '| # | Date | Source | Signal Summary | Score | Status |',
        '|---|------|--------|----------------|-------|--------|', '',
    ].join('\n'));
}
for (const name of ['businesses', 'sources']) {
    const target  = join(DATA_DIR, `config/${name}.yml`);
    const example = join(DATA_DIR, `config/${name}.example.yml`);
    if (!existsSync(target) && existsSync(example)) writeFileSync(target, readFileSync(example));
}

s.stop('Configuration saved.');

const firstName = identity.name.trim().split(' ')[0];
const sourceList = allEnabled.join(', ');

p.note(
    [
        `${pc.green('✓')} Profile    ${pc.dim(join(DATA_DIR, 'config/profile.yml'))}`,
        `${pc.green('✓')} API Keys   ${pc.dim(join(DATA_DIR, '.env'))} ${pc.dim('(gitignored)')}`,
        `${pc.green('✓')} Sources    ${pc.cyan(sourceList)}`,
        `${pc.green('✓')} Scan every ${pc.cyan(cronInterval)} · Notify at ${pc.cyan('score ' + notifyScore + '+')}`,
        '',
        pc.bold('Next steps:'),
        `  ${pc.cyan('signal-hunter doctor')}       → verify everything works`,
        `  ${pc.cyan('signal-hunter scan')}         → find your first signals`,
        `  ${pc.cyan('signal-hunter cron start')}   → start background daemon (every ${cronInterval})`,
        `  ${pc.cyan('signal-hunter insights')}     → track source performance`,
    ].join('\n'),
    'You\'re all set!'
);

p.outro(`Happy hunting, ${firstName}! 🎯`);
