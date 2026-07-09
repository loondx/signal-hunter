/**
 * Shared brand banner for Signal Hunter.
 *
 * banner()      — full ASCII logo + tagline (help screen, setup wizard)
 * brandLine()   — one-line brand stamp (version output, daemon startup)
 *
 * The full banner is skipped automatically when stdout is not a TTY
 * (piped output, CI logs) so scripts consuming the CLI stay clean.
 */

import pc from 'picocolors';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PKG_DIR } from './paths.js';

export function getVersion() {
    try {
        return JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8')).version;
    } catch {
        return '0.0.0';
    }
}

// Same figlet art as install.sh — one brand everywhere.
const ART = [
    '   _____ _                   _ _   _             _',
    '  / ____(_)                 | | | | |           | |',
    ' | (___  _  __ _ _ __   __ _| | |_| |_   _ _ __ | |_ ___ _ __',
    "  \\___ \\| |/ _` | '_ \\ / _` | |  _| | | | | '_ \\| __/ _ \\ '__|",
    '  ____) | | (_| | | | | (_| | | | | | |_| | | | | ||  __/ |',
    ' |_____/|_|\\__, |_| |_|\\__,_|_|_| |_|\\__,_|_| |_|\\__\\___|_|',
    '            __/ |',
    '           |___/',
].join('\n');

export function brandLine() {
    return `${pc.bold(pc.cyan('signal-hunter'))} ${pc.dim('v' + getVersion())} ${pc.dim('·')} ${pc.magenta('loondx')}`;
}

export function banner() {
    if (!process.stdout.isTTY) return '';
    return [
        pc.cyan(ART),
        '',
        `  ${pc.bold('AI agent that hunts buying signals for your business')}`,
        `  ${pc.dim('v' + getVersion())}  ${pc.dim('·')}  ${pc.magenta('by loondx')}  ${pc.dim('·')}  ${pc.dim('github.com/loondx/signal-hunter')}`,
        '',
    ].join('\n');
}

export function printBanner() {
    const b = banner();
    if (b) console.log(b);
}
