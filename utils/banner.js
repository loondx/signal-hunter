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

// "SIGNAL" in a solid block font — heavier strokes read clearly at any size.
const ART = [
    '  ███████╗ ██╗  ██████╗  ███╗   ██╗  █████╗  ██╗',
    '  ██╔════╝ ██║ ██╔════╝  ████╗  ██║ ██╔══██╗ ██║',
    '  ███████╗ ██║ ██║  ███╗ ██╔██╗ ██║ ███████║ ██║',
    '  ╚════██║ ██║ ██║   ██║ ██║╚██╗██║ ██╔══██║ ██║',
    '  ███████║ ██║ ╚██████╔╝ ██║ ╚████║ ██║  ██║ ███████╗',
    '  ╚══════╝ ╚═╝  ╚═════╝  ╚═╝  ╚═══╝ ╚═╝  ╚═╝ ╚══════╝',
];
const ART_WIDTH = 55;

export function brandLine() {
    return `${pc.bold(pc.cyan('signal-hunter'))} ${pc.dim('v' + getVersion())} ${pc.dim('·')} ${pc.magenta('loondx')}`;
}

export function banner() {
    if (!process.stdout.isTTY) return '';

    // Narrow terminal → compact one-line brand instead of clipped art
    if ((process.stdout.columns || 80) < ART_WIDTH + 2) {
        return `\n  ${pc.bold(pc.cyan('◢ SIGNAL HUNTER'))}  ${pc.dim('v' + getVersion())} ${pc.dim('·')} ${pc.magenta('by loondx')}\n`;
    }

    return [
        '',
        pc.bold(pc.cyan(ART.join('\n'))),
        `  ${pc.bold(pc.magenta('H U N T E R'))}  ${pc.dim('—')}  ${pc.bold('find paying clients before the job post')}`,
        '',
        `  ${pc.dim('v' + getVersion())}  ${pc.dim('·')}  ${pc.magenta('by loondx')}  ${pc.dim('·')}  ${pc.dim('github.com/loondx/signal-hunter')}`,
        '',
    ].join('\n');
}

export function printBanner() {
    const b = banner();
    if (b) console.log(b);
}
