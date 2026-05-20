#!/usr/bin/env node
// signal-hunter auth <platform>
// Guides through OAuth2 setup for platforms that require credentials.
// Supported: upwork, freelancer
//
// Usage:
//   signal-hunter auth upwork      — OAuth2 browser flow, saves tokens to .env
//   signal-hunter auth freelancer  — shows how to get a Freelancer.com token

import { createServer }  from 'http';
import { execSync }      from 'child_process';
import pc                from 'picocolors';
import * as p            from '@clack/prompts';
import { loadEnv }       from '../../utils/config.js';
import { appendEnvKey }  from '../../utils/env-writer.js';

loadEnv();

const platform = (process.argv[3] || process.argv[2] || '').toLowerCase().replace(/^auth$/, '');

console.log('');
p.intro(pc.bgCyan(pc.black('  Signal Hunter — Platform Auth  ')));

switch (platform) {
    case 'upwork':     await authUpwork();     break;
    case 'freelancer': await authFreelancer(); break;
    default:
        console.log(`
  ${pc.bold('signal-hunter auth <platform>')}  — Connect paid platforms

  ${pc.bold('Platforms:')}
    ${pc.cyan('signal-hunter auth upwork')}      Upwork OAuth2 (GraphQL API)
    ${pc.cyan('signal-hunter auth freelancer')}  Freelancer.com developer token

  ${pc.bold('After connecting:')}
    Enable the source in ${pc.dim('config/sources.yml')} and run ${pc.cyan('signal-hunter scan')}
`);
        process.exit(0);
}

// ── Upwork OAuth2 ─────────────────────────────────────────────────────────────
async function authUpwork() {
    const clientId     = process.env.UPWORK_CLIENT_ID;
    const clientSecret = process.env.UPWORK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        p.note(
            [
                pc.bold('1.') + ' Go to:  ' + pc.cyan('https://developers.upwork.com'),
                pc.bold('2.') + ' Click "API Keys" → "Get API Access" → Create App',
                pc.bold('3.') + ' Under "Callback URL" add: ' + pc.cyan('http://localhost:3456/callback'),
                pc.bold('4.') + ' Copy your Client ID and Client Secret',
                pc.bold('5.') + ' Add to your ' + pc.dim('.env') + ' file:',
                '',
                pc.dim('   UPWORK_CLIENT_ID=your_client_id'),
                pc.dim('   UPWORK_CLIENT_SECRET=your_client_secret'),
                '',
                pc.bold('6.') + ' Run again: ' + pc.cyan('signal-hunter auth upwork'),
            ].join('\n'),
            'Upwork OAuth2 Setup'
        );
        process.exit(1);
    }

    const PORT         = 3456;
    const REDIRECT_URI = `http://localhost:${PORT}/callback`;
    const AUTH_URL     = `https://www.upwork.com/api/v3/oauth2/authorize` +
        `?response_type=code&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    p.log.step('Opening Upwork authorization in your browser...');
    console.log(`\n  ${pc.dim('Auth URL:')} ${pc.cyan(AUTH_URL)}\n`);
    console.log(`  ${pc.dim('(If browser does not open, copy the URL above)')}\n`);

    openBrowser(AUTH_URL);

    // Start local server to catch callback
    p.log.info('Waiting for authorization callback on localhost:3456...');
    let code;
    try {
        code = await waitForCallback(PORT, '/callback', 'code');
    } catch (err) {
        p.log.error(`Callback error: ${err.message}`);
        process.exit(1);
    }

    p.log.step('Exchanging authorization code for tokens...');
    const tokenRes = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
            grant_type:    'authorization_code',
            code,
            redirect_uri:  REDIRECT_URI,
            client_id:     clientId,
            client_secret: clientSecret,
        }),
    });

    if (!tokenRes.ok) {
        p.log.error(`Token exchange failed: HTTP ${tokenRes.status}`);
        const body = await tokenRes.text().catch(() => '');
        if (body) console.error(pc.dim(body.slice(0, 200)));
        process.exit(1);
    }

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
        p.log.error(`No access_token in response: ${JSON.stringify(tokens).slice(0, 200)}`);
        process.exit(1);
    }

    appendEnvKey('UPWORK_ACCESS_TOKEN',  tokens.access_token);
    if (tokens.refresh_token) appendEnvKey('UPWORK_REFRESH_TOKEN', tokens.refresh_token);

    p.note(
        [
            pc.green('✓') + ' UPWORK_ACCESS_TOKEN  saved to .env',
            tokens.refresh_token ? pc.green('✓') + ' UPWORK_REFRESH_TOKEN saved to .env' : '',
            '',
            'Enable Upwork in config/sources.yml:',
            pc.dim('  upwork:'),
            pc.dim('    type: upwork'),
            pc.dim('    enabled: true'),
            pc.dim('    config:'),
            pc.dim('      search_queries:'),
            pc.dim('        - "react developer automation"'),
            pc.dim('        - "AI agent node.js freelance"'),
        ].filter(Boolean).join('\n'),
        'Upwork connected!'
    );

    p.outro('Run ' + pc.cyan('signal-hunter scan --source upwork') + ' to test it.');
}

// ── Freelancer.com token ──────────────────────────────────────────────────────
async function authFreelancer() {
    const existing = process.env.FREELANCER_OAUTH_TOKEN;

    p.note(
        [
            pc.bold('1.') + ' Go to: ' + pc.cyan('https://developers.freelancer.com'),
            pc.bold('2.') + ' Sign in → "My Apps" → "Create New Application"',
            pc.bold('3.') + ' App type: "Server Side" (no redirect URL needed)',
            pc.bold('4.') + ' After creating, go to "OAuth2 Token" tab → generate token',
            pc.bold('5.') + ' Copy the token and paste below',
        ].join('\n'),
        'Freelancer.com OAuth Token'
    );

    const token = await p.password({
        message: existing
            ? `Current token found. Paste new token (or press Enter to keep existing):`
            : 'Paste your Freelancer.com OAuth token:',
    });

    if (p.isCancel(token)) { p.cancel('Cancelled.'); process.exit(0); }

    const finalToken = token?.trim() || existing;
    if (!finalToken) { p.log.error('No token provided.'); process.exit(1); }

    appendEnvKey('FREELANCER_OAUTH_TOKEN', finalToken);

    p.note(
        [
            pc.green('✓') + ' FREELANCER_OAUTH_TOKEN saved to .env',
            '',
            'Enable Freelancer.com in config/sources.yml:',
            pc.dim('  freelancer:'),
            pc.dim('    type: freelancer'),
            pc.dim('    enabled: true'),
            pc.dim('    config:'),
            pc.dim('      skill_ids: [3, 17, 31, 43, 1049, 1392]'),
            pc.dim('      posts_per_scan: 20'),
        ].join('\n'),
        'Freelancer.com connected!'
    );

    p.outro('Run ' + pc.cyan('signal-hunter scan --source freelancer') + ' to test it.');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function openBrowser(url) {
    const cmd = process.platform === 'darwin' ? `open "${url}"` :
                process.platform === 'win32'  ? `start "" "${url}"` : `xdg-open "${url}"`;
    try { execSync(cmd, { stdio: 'ignore' }); } catch {}
}

function waitForCallback(port, path, paramName, timeoutMs = 120_000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            server.close();
            reject(new Error('Timed out waiting for OAuth2 callback (2 minutes)'));
        }, timeoutMs);

        const server = createServer((req, res) => {
            try {
                const url    = new URL(req.url, `http://localhost:${port}`);
                if (url.pathname !== path) return;

                const error = url.searchParams.get('error');
                if (error) {
                    res.writeHead(400); res.end(`Error: ${error}`);
                    server.close(); clearTimeout(timer);
                    return reject(new Error(`OAuth2 error: ${error}`));
                }

                const value = url.searchParams.get(paramName);
                if (!value) { res.writeHead(400); res.end('Missing param'); return; }

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`<html><body style="font-family:sans-serif;padding:2rem">
                  <h2>✓ Authorized!</h2>
                  <p>You can close this tab and return to your terminal.</p>
                </body></html>`);

                server.close(); clearTimeout(timer);
                resolve(value);
            } catch (e) { reject(e); }
        });

        server.listen(port, '127.0.0.1', () => {
            // Server is ready
        });
        server.on('error', (e) => { clearTimeout(timer); reject(e); });
    });
}
