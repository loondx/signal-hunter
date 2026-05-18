#!/usr/bin/env node
import * as p from '@clack/prompts';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dump } from 'js-yaml';
import pc from 'picocolors';
import { join } from 'path';
import { DATA_DIR } from './utils/paths.js';

function onCancel() {
    p.cancel('Setup cancelled. Run `signal-hunter setup` whenever you\'re ready.');
    process.exit(0);
}

function guard(value) {
    if (p.isCancel(value)) onCancel();
    return value;
}

// ── Load .env if it exists (for re-runs) ─────────────────────────────────────
if (existsSync(join(DATA_DIR, '.env'))) {
    for (const line of readFileSync(join(DATA_DIR, '.env'), 'utf8').split('\n')) {
        const [key, ...rest] = line.split('=');
        if (key && !key.startsWith('#') && rest.length) {
            process.env[key.trim()] ??= rest.join('=').trim();
        }
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('');
p.intro(pc.bgCyan(pc.black('  Signal Hunter — Setup  ')));

// Check for existing config
if (existsSync(join(DATA_DIR, 'config/profile.yml'))) {
    const overwrite = guard(await p.confirm({
        message: 'A profile already exists. Overwrite it?',
        initialValue: false,
    }));
    if (!overwrite) {
        p.outro('Setup skipped — your existing config is unchanged.');
        process.exit(0);
    }
}

p.note(
    'This takes ~2 minutes.\nYour config stays on your machine — nothing is sent anywhere.',
    'Getting started'
);

// ── Step 1: Identity ──────────────────────────────────────────────────────────
const identity = await p.group({
    name: () => p.text({
        message: 'Your name or company name:',
        placeholder: 'Pankaj / Loondx',
        validate: (v) => !v?.trim() ? 'Name is required' : undefined,
    }),
    email: () => p.text({
        message: 'Your email (used for daily digest notifications):',
        placeholder: 'you@example.com',
    }),
    type: () => p.select({
        message: 'What best describes you?',
        options: [
            { value: 'freelancer', label: 'Freelancer', hint: 'solo contractor' },
            { value: 'agency',     label: 'Small agency', hint: 'service business with a team' },
            { value: 'both',       label: 'Both', hint: 'I freelance + have partner businesses' },
        ],
    }),
}, { onCancel });

// ── Step 2: Services + Signal Config ─────────────────────────────────────────
p.note(
    'Tell the AI what buying signals to look for.\nPlain English — be specific about the PAIN your clients have.',
    'Step 2 of 5 — Your Services'
);

const services = await p.group({
    what_you_do: () => p.text({
        message: 'What do you offer? (one line)',
        placeholder: 'Discord bots, n8n automation, AI integrations for small businesses',
        validate: (v) => !v?.trim() ? 'Required' : undefined,
    }),
    buying_signals: () => p.text({
        message: 'What problems do your clients usually have?',
        placeholder: 'Their workflows are manual, they need a Discord bot, they want to connect APIs',
        validate: (v) => !v?.trim() ? 'Required' : undefined,
    }),
    red_flags: () => p.text({
        message: 'What should the AI ignore? (comma-separated, optional)',
        placeholder: 'blockchain, equity only, unpaid test, web3',
    }),
    budget_min: () => p.text({
        message: 'Minimum project budget? (optional — for filtering low-value signals)',
        placeholder: '$500',
    }),
}, { onCancel });

// ── Step 3: Sources ───────────────────────────────────────────────────────────
p.note('Choose where Signal Hunter looks for buying signals.', 'Step 3 of 5 — Sources');

const sourcesEnabled = guard(await p.multiselect({
    message: 'Which sources to monitor? (space to toggle, enter to confirm)',
    options: [
        { value: 'hackernews', label: 'Hacker News',  hint: 'free · no auth · "Who is Hiring?" + discussions',  selected: true },
        { value: 'reddit',     label: 'Reddit',       hint: 'free · no auth · r/forhire, r/freelance + more',    selected: true },
        { value: 'remoteok',   label: 'Remote OK',    hint: 'free · open API · freelance & remote gigs',          selected: true },
        { value: 'twitter',    label: 'Twitter / X',  hint: 'requires TWITTER_BEARER_TOKEN in .env',              selected: false },
        { value: 'custom',     label: 'Custom URLs',  hint: 'monitor any webpage via Jina.ai — free, no auth',    selected: false },
    ],
    required: true,
}));

let redditSubs = 'forhire,freelance,webdev,startups';
if (sourcesEnabled.includes('reddit')) {
    const subs = guard(await p.text({
        message: 'Subreddits to watch? (comma-separated, no "r/")',
        placeholder: 'forhire,freelance,webdev,startups,entrepreneur',
        initialValue: 'forhire,freelance,webdev,startups',
    }));
    redditSubs = subs || 'forhire,freelance,webdev,startups';
}

// ── Step 4: LLM ───────────────────────────────────────────────────────────────
p.note(
    'Signal Hunter uses an LLM to understand intent — not just keyword matching.\nGemini Flash has a generous free tier and is recommended for getting started.',
    'Step 4 of 5 — AI Brain'
);

const llmProvider = guard(await p.select({
    message: 'Which LLM to use?',
    options: [
        { value: 'gemini', label: 'Google Gemini Flash',   hint: 'free tier — recommended for getting started' },
        { value: 'openai', label: 'OpenAI GPT-4o-mini',    hint: 'paid · very fast and accurate' },
        { value: 'claude', label: 'Anthropic Claude Haiku', hint: 'paid · excellent reasoning' },
        { value: 'ollama', label: 'Ollama (local)',          hint: 'free · runs on your machine · 100% private' },
    ],
}));

const LLM_MODELS = {
    gemini: 'gemini-flash-latest',
    openai: 'gpt-4o-mini',
    claude: 'claude-haiku-4-5-20251001',
    ollama: 'llama3.2',
};

const KEY_NAMES = {
    gemini: 'GEMINI_API_KEY',
    openai: 'OPENAI_API_KEY',
    claude: 'ANTHROPIC_API_KEY',
    ollama: null,
};

const KEY_HINTS = {
    gemini: 'aistudio.google.com → "Get API key" (free)',
    openai: 'platform.openai.com/api-keys',
    claude: 'console.anthropic.com/settings/keys',
};

let apiKey = '';
const keyName = KEY_NAMES[llmProvider];
if (keyName) {
    const existing = process.env[keyName];
    if (existing && existing.length > 10) {
        const reuse = guard(await p.confirm({
            message: `Found existing ${keyName} in environment. Use it?`,
            initialValue: true,
        }));
        if (reuse) {
            apiKey = existing;
        }
    }
    if (!apiKey) {
        apiKey = guard(await p.password({
            message: `Paste your ${keyName}  ${pc.dim('(' + KEY_HINTS[llmProvider] + ')')}:`,
            validate: (v) => !v?.trim() ? 'API key is required' : undefined,
        }));
    }
}

// ── Step 5: Notifications ─────────────────────────────────────────────────────
p.note(
    'Signal Hunter notifies you when a strong buying signal is found.\nDiscord webhook = paste a URL, done. No bot setup needed.',
    'Step 5 of 5 — Notifications'
);

const wantsDiscord = guard(await p.confirm({
    message: 'Send high-score signals to Discord?',
    initialValue: false,
}));

let discordWebhook = '';
if (wantsDiscord) {
    discordWebhook = guard(await p.text({
        message: 'Discord webhook URL:',
        placeholder: 'https://discord.com/api/webhooks/...',
        validate: (v) => {
            if (!v?.trim()) return 'Required';
            if (!v.startsWith('https://discord.com/api/webhooks/')) return 'Must be a Discord webhook URL';
        },
    }));
}

// ── Write files ───────────────────────────────────────────────────────────────
const s = p.spinner();
s.start('Writing your configuration...');

mkdirSync(join(DATA_DIR, 'config'), { recursive: true });
mkdirSync(join(DATA_DIR, 'data'),   { recursive: true });
mkdirSync(join(DATA_DIR, 'logs'),   { recursive: true });

// profile.yml
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
            ? services.red_flags.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        budget_min: services.budget_min?.trim() || '',
    },
    llm: {
        provider: llmProvider,
        model:    LLM_MODELS[llmProvider],
        min_score: 60,
    },
    sources: {
        enabled: sourcesEnabled,
        reddit: {
            subreddits: redditSubs.split(',').map((s) => s.trim().replace(/^r\//, '')).filter(Boolean),
        },
    },
    notifications: {
        discord_webhook:  discordWebhook || '',
        email:            identity.email?.trim() || '',
        notify_min_score: 70,
    },
};

writeFileSync(join(DATA_DIR, 'config/profile.yml'), dump(profile, { lineWidth: 120 }));

// .env
const envLines = [
    '# Signal Hunter — API Keys',
    '# DO NOT commit this file to git (it is in .gitignore)',
    '',
];
if (llmProvider !== 'ollama') envLines.push(`${keyName}=${apiKey}`);
if (llmProvider === 'ollama')  envLines.push('OLLAMA_BASE_URL=http://localhost:11434');
if (discordWebhook)            envLines.push('', `DISCORD_WEBHOOK_URL=${discordWebhook}`);

writeFileSync(join(DATA_DIR, '.env'), envLines.join('\n') + '\n');

// Initialize empty pipeline if it doesn't exist
if (!existsSync(join(DATA_DIR, 'data/signals.md'))) {
    writeFileSync(join(DATA_DIR, 'data/signals.md'), [
        '# Signal Pipeline',
        '',
        '| # | Date | Source | Signal Summary | Score | Business | Status |',
        '|---|------|--------|----------------|-------|----------|--------|',
        '',
    ].join('\n'));
}

// Copy example files if real ones don't exist yet
for (const name of ['businesses', 'sources']) {
    const target = `${join(DATA_DIR, "config/")}${name}.yml`;
    const example = `${join(DATA_DIR, "config/")}${name}.example.yml`;
    if (!existsSync(target) && existsSync(example)) {
        writeFileSync(target, readFileSync(example));
    }
}

s.stop('Configuration saved.');

// ── Summary ────────────────────────────────────────────────────────────────
const firstName = identity.name.trim().split(' ')[0];

p.note(
    [
        `${pc.green('✓')} Profile     ${pc.cyan(join(DATA_DIR, 'config/profile.yml'))}`,
        `${pc.green('✓')} API Keys    ${pc.cyan(join(DATA_DIR, '.env'))} ${pc.dim('(gitignored — your keys stay private)')}`,
        `${pc.green('✓')} Pipeline    ${pc.cyan(join(DATA_DIR, 'data/signals.md'))}`,
        `${pc.green('✓')} Businesses  ${pc.cyan(join(DATA_DIR, 'config/businesses.yml'))} ${pc.dim('(edit to add partner businesses)')}`,
        '',
        pc.bold('Next steps:'),
        `  ${pc.cyan('signal-hunter doctor')}  → verify everything is working`,
        `  ${pc.cyan('signal-hunter scan')}    → find your first signals`,
        '',
        pc.dim('To automate: add `signal-hunter scan` to your crontab'),
        pc.dim('  Example: */30 * * * * cd /path/to/signal-hunter && signal-hunter scan'),
    ].join('\n'),
    'You\'re all set!'
);

p.outro(`Happy hunting, ${firstName}! 🎯`);
