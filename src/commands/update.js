#!/usr/bin/env node
// signal-hunter update — pulls latest code and reinstalls dependencies
import { execSync }              from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join }                  from 'path';
import pc                        from 'picocolors';
import { PKG_DIR }               from '../../utils/paths.js';

function run(cmd, opts = {}) {
    return execSync(cmd, { cwd: PKG_DIR, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

console.log('');
console.log('  ' + pc.bold(pc.cyan('Signal Hunter')) + ' — Update');
console.log('');

const isGitInstall = existsSync(join(PKG_DIR, '.git'));

if (!isGitInstall) {
    console.log('  ' + pc.yellow('⚠') + '  Installed via npm — update with:');
    console.log('');
    console.log('    ' + pc.cyan('npm install -g signal-hunter@latest'));
    console.log('');
    process.exit(0);
}

// Run URL migration on every update to fix old.reddit.com in existing data
try {
    const { migrateSignalUrls } = await import('../utils/store.js');
    const fixed = migrateSignalUrls();
    if (fixed > 0) console.log('  ' + pc.green('✓') + `  Migrated ${fixed} signal URLs (old.reddit.com → www.reddit.com)`);
} catch {}

try {
    const pkg = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'));
    const currentHash = run('git rev-parse --short HEAD');
    console.log('  ' + pc.dim(`Current: v${pkg.version} (${currentHash})`));

    process.stdout.write('  ' + pc.cyan('→') + '  Checking for updates...');
    run('git fetch --quiet');

    const behind = run('git rev-list HEAD..origin/main --count');
    if (behind === '0') {
        process.stdout.write('\r  ' + pc.green('✓') + '  Already up to date.           \n\n');
        process.exit(0);
    }

    process.stdout.write('\r  ' + pc.cyan('→') + `  ${behind} update(s) available — pulling...\n`);

    run('git reset --hard origin/main --quiet');
    const newHash = run('git rev-parse --short HEAD');
    console.log('  ' + pc.green('✓') + '  Code updated → ' + pc.dim(newHash));

    process.stdout.write('  ' + pc.cyan('→') + '  Updating dependencies...');
    run('npm install --omit=dev --silent');
    process.stdout.write('\r  ' + pc.green('✓') + '  Dependencies updated.          \n');

    console.log('');
    console.log('  ' + pc.green(pc.bold('✓  Update complete!')));
    console.log('');
} catch (err) {
    console.error('\n  ' + pc.red('✗  Update failed: ' + err.message));
    process.exit(1);
}
