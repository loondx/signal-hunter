#!/usr/bin/env node
import * as p from '@clack/prompts';
import { existsSync, readFileSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';
import { DATA_DIR } from './utils/paths.js';
import pc from 'picocolors';

// ── Load .env before checking env vars ───────────────────────────────────────
if (existsSync(join(DATA_DIR, '.env'))) {
    for (const line of readFileSync(join(DATA_DIR, '.env'), 'utf8').split('\n')) {
        const [key, ...rest] = line.split('=');
        if (key?.trim() && !key.startsWith('#') && rest.length) {
            process.env[key.trim()] ??= rest.join('=').trim();
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ok   = (msg)       => ({ pass: true,  msg });
const fail = (msg, hint) => ({ pass: false, msg, hint });
const warn = (msg, hint) => ({ pass: null,  msg, hint });

// ── Run checks ────────────────────────────────────────────────────────────────
console.log('');
p.intro(pc.bgYellow(pc.black('  Signal Hunter — Health Check  ')));

const results = [];
let profile = null;

// 1. Node version
const [major] = process.versions.node.split('.').map(Number);
if (major >= 20) {
    results.push(ok(`Node.js v${process.versions.node}`));
} else {
    results.push(fail(`Node.js v${process.versions.node} is too old`, 'Upgrade to v20+ → https://nodejs.org'));
}

// 2. Config dir + profile.yml
if (!existsSync(join(DATA_DIR, 'config/profile.yml'))) {
    results.push(fail('config/profile.yml not found', 'Run: signal-hunter setup'));
} else {
    try {
        profile = load(readFileSync(join(DATA_DIR, 'config/profile.yml'), 'utf8'));
        results.push(ok('config/profile.yml — found and valid'));
    } catch (e) {
        results.push(fail('config/profile.yml — invalid YAML', `Fix the YAML error: ${e.message}`));
    }
}

// 3. .env file
if (!existsSync(join(DATA_DIR, '.env'))) {
    results.push(warn('.env file not found', 'Run: signal-hunter setup — or copy .env.example to .env'));
} else {
    results.push(ok('.env file found'));
}

// 4. LLM API key
if (profile?.llm) {
    const KEY = { gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY', claude: 'ANTHROPIC_API_KEY', ollama: null };
    const HINT = {
        gemini: 'aistudio.google.com → Get API key (free)',
        openai: 'platform.openai.com/api-keys',
        claude: 'console.anthropic.com/settings/keys',
    };
    const keyName = KEY[profile.llm.provider];

    if (keyName) {
        const val = process.env[keyName];
        if (val && val.length > 10) {
            results.push(ok(`${keyName} is set (provider: ${profile.llm.provider})`));
        } else {
            results.push(fail(`${keyName} is missing or empty`, `Get one at: ${HINT[profile.llm.provider]}`));
        }
    } else {
        results.push(ok(`Ollama mode — no API key needed (make sure Ollama is running)`));
    }
} else if (profile) {
    results.push(warn('LLM provider not set in profile', 'Run: signal-hunter setup'));
}

// 5. Required dirs
for (const dir of ['data', 'logs', 'config']) {
    if (existsSync(`./${dir}`)) {
        results.push(ok(`${dir}/ directory exists`));
    } else {
        results.push(fail(`${dir}/ directory missing`, `Run: mkdir ${dir}`));
    }
}

// 6. Source-specific credential checks
if (profile?.sources?.enabled) {
    const enabled = profile.sources.enabled;

    if (enabled.includes('reddit')) {
        results.push(ok('Reddit — uses public RSS feeds (no credentials needed)'));
    }

    if (enabled.includes('twitter')) {
        if (process.env.TWITTER_BEARER_TOKEN) {
            results.push(ok('Twitter — TWITTER_BEARER_TOKEN is set'));
        } else {
            results.push(warn(
                'Twitter — TWITTER_BEARER_TOKEN not set (source will be skipped)',
                'Fix: developer.x.com → Create App → Keys & Tokens → Bearer Token → add to .env\nOR remove "twitter" from sources.enabled in config/profile.yml'
            ));
        }
    }
}

// 7. Optional: businesses.yml
if (existsSync(join(DATA_DIR, 'config/businesses.yml'))) {
    try {
        const biz = load(readFileSync(join(DATA_DIR, 'config/businesses.yml'), 'utf8'));
        const count = biz?.businesses?.length ?? 0;
        results.push(ok(`config/businesses.yml — ${count} business(es) configured`));
    } catch {
        results.push(warn('config/businesses.yml — invalid YAML', 'Check the file for syntax errors'));
    }
} else {
    results.push(warn('config/businesses.yml not found', 'Optional — copy config/businesses.example.yml to add partner businesses'));
}

// 7. Pipeline file
if (existsSync(join(DATA_DIR, 'data/signals.md'))) {
    results.push(ok('data/signals.md — pipeline file exists'));
} else {
    results.push(warn('data/signals.md not found', 'It will be created on first scan'));
}

// ── Print results ─────────────────────────────────────────────────────────────
console.log('');
for (const r of results) {
    const icon =
        r.pass === true  ? pc.green('✓') :
        r.pass === false ? pc.red('✗') :
        pc.yellow('⚠');
    console.log(`  ${icon}  ${r.msg}`);
    if (r.hint && r.pass !== true) {
        console.log(`     ${pc.dim(r.hint)}`);
    }
}

const failures = results.filter((r) => r.pass === false);
const warnings = results.filter((r) => r.pass === null);

console.log('');

if (failures.length === 0 && warnings.length === 0) {
    p.outro(pc.green('All checks passed — ready to scan!  signal-hunter scan'));
} else if (failures.length === 0) {
    p.outro(pc.yellow(`${warnings.length} warning(s) — optional items missing. You can still scan.`));
} else {
    p.outro(pc.red(`${failures.length} error(s) found — fix them before scanning.`));
    process.exit(1);
}
