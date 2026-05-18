import { readFileSync, existsSync } from 'fs';
import { load } from 'js-yaml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
    const path = join(ROOT, '.env');
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const eqIdx = line.indexOf('=');
        if (eqIdx < 1) continue;
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim();
        if (!key || key.startsWith('#')) continue;
        process.env[key] ??= val;
    }
}

export function loadProfile() {
    const path = join(ROOT, 'config/profile.yml');
    if (!existsSync(path)) {
        throw new Error('config/profile.yml not found. Run: signal-hunter setup');
    }
    return load(readFileSync(path, 'utf8'));
}

export function loadBusinesses() {
    const path = join(ROOT, 'config/businesses.yml');
    if (!existsSync(path)) return null;
    const data = load(readFileSync(path, 'utf8'));
    return data?.businesses?.length ? data.businesses : null;
}

export function loadSourcesConfig() {
    const path = join(ROOT, 'config/sources.yml');
    if (!existsSync(path)) return null;
    return load(readFileSync(path, 'utf8'))?.sources ?? null;
}
