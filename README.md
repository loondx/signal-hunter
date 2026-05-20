<div align="center">

<h1>🎯 Signal Hunter</h1>

<p><strong>AI agent that finds paying clients before they post a job listing.</strong></p>

<p>
  <a href="https://www.npmjs.com/package/signal-hunter"><img src="https://img.shields.io/npm/v/signal-hunter?color=brightgreen&style=flat-square" alt="npm"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square" alt="Node.js"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" alt="Platforms">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-purple?style=flat-square" alt="MCP"></a>
</p>

</div>

---

Job boards show you listings **200 people already applied to.**

Signal Hunter watches Reddit, Hacker News, Remotive, Remote OK, Dev.to, Upwork, Freelancer.com — and the whole internet — for the moment someone publicly describes a problem you can solve. The AI scores each post 0–100, filters out job seekers and noise, pings you on Discord the second a real lead appears, and generates a full ready-to-send message so you can reply first.

```
  [95] 🔥  Upwork                       new    2026-05-20
           "Need n8n automation expert — webhook pipeline from Stripe to
            Notion to Slack. Budget $800–1200. Start ASAP."
           ↳ Explicit budget + scope + urgency. Apply today.
           💰 $800 – $1,200 fixed

  [88] 📌  Reddit r/SaaS                new    2026-05-20
           "Our team spends 3h/day copying data between Airtable and HubSpot.
            Looking for a contractor to automate this — $500–800 budget."
           ↳ Quantified pain + budget + contractor intent. Strong lead.
           💰 $500 – $800

  [81] 📌  Hacker News — Who's Hiring?  new    2026-05-20
           "React + Node contractor wanted — AI dashboard for fintech startup,
            3-month engagement, $8k/month budget, remote."
           ↳ Long engagement, real budget, specific tech stack match.
           💰 $8,000/month
```

```bash
signal-hunter reply 1
```
```
  Platform: upwork  →  apply via the job listing Apply button

  ✉  MESSAGE — Copy & Send
  ──────────────────────────────────────────────────────────────

  Your Stripe → Notion → Slack pipeline is exactly the kind of
  multi-step webhook chain I build with n8n — I automated a similar
  setup for a SaaS team last month (Stripe webhooks + Notion database
  + Slack alerts) in about 4 hours. Happy to share a quick Loom of
  how it's structured, or sketch the architecture for your specific
  use case if you want to see it before committing.

  ──────────────────────────────────────────────────────────────
  💪 Your edge: Direct n8n experience with this exact Stripe → Notion pattern

  🔁 Follow-up (day 3-4 if no response):
  Still open on the automation project? Happy to send over a quick
  architecture sketch — takes me 10 minutes and gives you a clear
  picture of what's involved.
```

---

## What makes it different

<table>
<tr>
  <td><b>Finds leads before job boards</b></td>
  <td>Scans Reddit posts, HN comments, and dev community discussions — where clients describe pain before they even know they need to post a job.</td>
</tr>
<tr>
  <td><b>Filters job seekers automatically</b></td>
  <td>Pre-filter detects "[FOR HIRE]" posts and people looking for work before spending any AI credits. You only see clients, not competition.</td>
</tr>
<tr>
  <td><b>Prioritises job boards in the AI queue</b></td>
  <td>Upwork and Freelancer.com candidates qualify before Reddit discussions. Real projects with budgets get your attention first.</td>
</tr>
<tr>
  <td><b>Gets smarter every time you reply</b></td>
  <td>Every <code>reply</code> and <code>skip</code> updates a local learning file. The AI prompt gets personalised context from your own history — which sources convert, which keywords matter to you.</td>
</tr>
<tr>
  <td><b>Generates the full outreach</b></td>
  <td><code>signal-hunter reply N</code> produces a complete package: copy-paste message, platform send instructions, day-4 follow-up, proposal opener, and scope questions.</td>
</tr>
<tr>
  <td><b>Plugin-based sources — zero code to extend</b></td>
  <td>Add any RSS feed, JSON API, or webpage as a source in <code>sources.yml</code>. No code changes. Works like openclaw's provider system.</td>
</tr>
<tr>
  <td><b>Everything stays local</b></td>
  <td>No account. No cloud. No credit card. Config, signals, and tokens live on your machine.</td>
</tr>
</table>

---

## Install

### macOS / Linux
```bash
curl -fsSL https://raw.githubusercontent.com/loondx/signal-hunter/main/install.sh | bash
```

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/loondx/signal-hunter/main/install.ps1 | iex
```

### Any OS — npm global
```bash
npm install -g signal-hunter
```

> **Requires Node.js 20+.** The installers auto-install Node.js if missing (via Homebrew / nvm / winget).

### First run
```bash
signal-hunter setup      # 3-minute wizard: sources, API keys, Discord, scan interval
signal-hunter doctor     # verify everything is connected
signal-hunter scan       # find your first leads
```

---

## How it works

```
Every N minutes (you choose during setup):

  1. Fetch  →  Reddit RSS, HN Algolia, Remotive API, Dev.to API,
               Upwork GraphQL, Freelancer.com API, web search, custom URLs

  2. Filter →  Kill job-seeker posts ("[FOR HIRE]", "available for hire") before AI
               Kill red flags (crypto, gambling, equity-only) instantly

  3. Sort   →  Job boards first (Upwork=110, Remotive=100, HN Jobs=92)
               then community posts (Reddit forhire=65, general Reddit=30)

  4. Score  →  AI rates top N candidates 0-100 for buying intent
               Injects learned patterns from your reply/skip history

  5. Save   →  Signals above min_score go to your pipeline
               Signals above notify_score ping Discord immediately

  6. Reply  →  signal-hunter reply N  →  full AI outreach package
```

---

## Quick Start Guide

```bash
# 1. Install
curl -fsSL https://raw.githubusercontent.com/loondx/signal-hunter/main/install.sh | bash

# 2. Set up (takes 3 minutes)
signal-hunter setup

# 3. Test connection
signal-hunter doctor

# 4. First scan
signal-hunter scan

# 5. View your pipeline
signal-hunter list

# 6. Act on a lead (generates full outreach)
signal-hunter reply 1

# 7. Run it automatically
signal-hunter cron start       # uses interval you chose in setup
```

---

## Sources

Signal Hunter is plugin-based — each source is one line in `sources.yml`.

### Free (no credentials)

| Source | What you get |
|--------|-------------|
| **Reddit** | 35+ subreddits: r/forhire, r/freelance, r/startups, r/n8n, r/SaaS, r/AI_Agents… |
| **Hacker News** | "Who is Hiring?" monthly thread + Algolia keyword search |
| **Remote OK** | Remote job API — open, no auth |
| **Remotive** | Curated remote jobs API — software-dev, devops, product |
| **Dev.to** | `#hiring`, `#webdev`, `#automation`, `#react`, `#ai` tags |
| **Any RSS feed** | Add any job board RSS in `sources.yml` — no code |
| **Any JSON API** | Map any API response to signals — fully configurable |
| **Any webpage** | Jina.ai reader — IndieHackers, We Work Remotely, any site |

### Premium (credentials required)

| Source | Setup | What you get |
|--------|-------|-------------|
| **Upwork** | `signal-hunter auth upwork` — browser OAuth2 flow | Real client projects with budgets, filtered by your search queries |
| **Freelancer.com** | `signal-hunter auth freelancer` — free token at developers.freelancer.com | Active projects filtered by your skill IDs |
| **Web Search** | `SERPER_API_KEY` in `.env` (free 2500 queries at serper.dev) | Entire internet searched for hiring-intent posts |

### Add any source without code

```yaml
# config/sources.yml — just add an entry, no code changes needed

# Any RSS feed
weworkremotely:
  type: rss
  enabled: true
  config:
    url: "https://weworkremotely.com/categories/remote-programming-jobs.rss"
    label: "We Work Remotely"
    posts_per_scan: 20

# Any JSON API
my_custom_board:
  type: json_api
  enabled: true
  config:
    url: "https://api.example.com/jobs"
    auth_header_env: "MY_API_KEY"
    response_path: "data.jobs"
    id_field: "id"
    text_fields: ["title", "description"]
    url_field: "apply_url"
    author_field: "company.name"
    date_field: "published_at"
    label: "My Job Board"
```

---

## Configuration

### `config/profile.yml` — the most important file

The AI reads your profile in plain English. **Write client pain, not your skills.**

```yaml
version: "1"

identity:
  name: "Pankaj / Loondx"
  type: freelancer            # freelancer | agency | both

services:
  # What you actually build
  what_you_do: >-
    Full-stack AI engineer: React, Node.js, n8n automation, Discord bots,
    AI agents (Claude, OpenAI), SaaS MVP development, REST APIs, AWS serverless.

  # Describe the PAIN your clients have — not your skills
  buying_signals: >-
    Their workflows are manual and take too much time. They need a Discord bot,
    AI agent, n8n automation, CRM/dashboard, or SaaS MVP built fast. They're
    a founder or small team, not a large enterprise. They mention budget or timeline.

  red_flags:
    - equity only
    - work for revenue share
    - gambling platform
    - adult content
    - crypto token

  budget_min: "$300"

llm:
  provider: claude            # gemini (free) | claude | openai | ollama
  model: claude-haiku-4-5-20251001
  min_score: 55               # save signals above this score

sources:
  enabled:
    - hackernews
    - reddit
    - remoteok
    - remotive
    - devto
    - upwork          # after: signal-hunter auth upwork
    - freelancer      # after: signal-hunter auth freelancer

  reddit:
    subreddits:
      # Direct hire intent
      - forhire
      - freelance_forhire
      - for_hire
      - hiring
      # Problem signals — clients with budgets
      - startups
      - SaaS
      - Entrepreneur
      - smallbusiness
      - indiehackers
      # Tech communities
      - n8n
      - automation
      - nocode
      - AI_Agents
      - webdev

notifications:
  discord_webhook: "https://discord.com/api/webhooks/..."
  notify_min_score: 65

automation:
  cron_interval: 30m          # set during setup — used by `cron start`
```

### Strong vs weak profile

❌ **Weak** — produces noise:
```yaml
what_you_do: "I do automation and AI stuff"
buying_signals: "people who need bots"
```

✅ **Strong** — produces real leads:
```yaml
what_you_do: >-
  Discord bots and n8n workflow automation that replace $50/month SaaS bots
  and broken Zapier flows — for startups, communities, and small businesses.

buying_signals: >-
  Zapier or Make workflows that keep breaking or got too expensive.
  Community owners who need a welcome bot, role assignment, or moderation.
  Startups doing manual copy-paste between Notion, Airtable, Slack, or Google Sheets.
  Anyone asking how to connect two tools without code.
```

---

## Commands

```bash
# ── Setup ──────────────────────────────────────────────────────────────
signal-hunter setup                    # interactive wizard (run first)
signal-hunter doctor                   # check config, API keys, connectivity
signal-hunter doctor --test-discord    # send a test ping to Discord
signal-hunter auth upwork              # connect Upwork via OAuth2 browser flow
signal-hunter auth freelancer          # connect Freelancer.com token

# ── Scanning ───────────────────────────────────────────────────────────
signal-hunter scan                     # scan all enabled sources
signal-hunter scan --source upwork     # single source only
signal-hunter scan --dry-run           # qualify without saving anything
signal-hunter scan --min-score 50      # lower threshold for this run

# ── Pipeline ───────────────────────────────────────────────────────────
signal-hunter list                     # view pipeline, sorted by score
signal-hunter list --min-score 75      # filter by score
signal-hunter list --status new        # new | replied | skipped
signal-hunter list --source remotive   # filter by source
signal-hunter insights                 # source performance, score stats, recommendations

# ── Acting on leads ────────────────────────────────────────────────────
signal-hunter reply <num>              # full AI outreach package — copy-paste ready
signal-hunter skip  <num>             # hide from pipeline (updates self-learning)
signal-hunter open  <num>             # open original URL in browser

# ── Automation ─────────────────────────────────────────────────────────
signal-hunter cron start               # start background daemon (reads interval from profile)
signal-hunter cron start --interval 1h # override interval: 15m | 30m | 1h | 2h | 6h | 12h | 24h
signal-hunter cron stop
signal-hunter cron status
signal-hunter cron logs
signal-hunter cron install             # print crontab / Task Scheduler / launchd / PM2 config

# ── Maintenance ────────────────────────────────────────────────────────
signal-hunter update                   # pull latest from GitHub
signal-hunter version
```

---

## Self-learning

Every action you take trains the agent. No config needed.

```bash
signal-hunter reply 3    # records: source, score, keywords — "this was worth my time"
signal-hunter skip 7     # records: "this type of signal isn't worth my time"
```

After a few replies and skips, the AI qualifier prompt automatically includes:

```
LEARNED PATTERNS (from 12 replied, 8 skipped signals):
- Source reply rates: Upwork: 80% (8/10), Remotive: 60% (3/5), Reddit r/webdev: 10% (1/10)
- Average score of signals you actually replied to: 74/100
- Keywords common in your replies: n8n, automation, webhook, budget, urgent, api
- Keywords common in signals you skipped: how do i, tutorial, free, help me understand
```

The scoring adapts to *your* actual conversion behaviour — not generic intent signals.

View your learning data:
```bash
signal-hunter insights
```

---

## Automation — run it while you sleep

### Built-in daemon (all platforms)
```bash
signal-hunter cron start           # uses interval from your profile (set in setup)
signal-hunter cron start --interval 30m   # override
signal-hunter cron status
signal-hunter cron stop
```

### OS-native scheduling
```bash
signal-hunter cron install         # prints setup instructions for your OS
```

Shows:
- **Windows**: Task Scheduler `Register-ScheduledTask` commands
- **macOS**: launchd plist for `~/Library/LaunchAgents/`
- **Linux**: systemd unit file + crontab
- **All**: PM2 commands for crash-recovery and boot persistence

### VPS / server (recommended for reliability)
```bash
npm install -g pm2
pm2 start "$(signal-hunter version --path)/src/daemon.js" \
  --name signal-hunter -- --interval 30m
pm2 save && pm2 startup
```

---

## Discord notifications

Every strong signal pings your Discord with a formatted embed:

- **Source badge** — 🔴 Reddit / 🟠 HN / 💼 Remotive / 💻 Remote OK / 🟢 Upwork
- **Score and urgency** — `🔥 HOT LEAD → respond TODAY`
- **Their post** — first 400 chars
- **Why this lead** — AI reasoning in one sentence
- **Budget signal** — extracted if mentioned
- **Copy & Send** — outreach angle in a code block (select all, copy, paste)
- **Open Post** — direct link to the original

Setup: Discord server → Edit channel → Integrations → Webhooks → New Webhook → Copy URL → paste as `DISCORD_WEBHOOK_URL` in `.env`.

---

## LLMs

| Provider | Model | Cost | Notes |
|----------|-------|------|-------|
| **Google Gemini** | `gemini-flash-latest` | Free tier | Best to start — 15 RPM free |
| **Anthropic Claude** | `claude-haiku-4-5-20251001` | ~$0.01/50 signals | Best intent reasoning |
| **OpenAI** | `gpt-4o-mini` | ~$0.01/50 signals | Fast, reliable |
| **Ollama** | `llama3.2` | Free | 100% local — no API key |

The same provider is used for both scoring and outreach generation (`signal-hunter reply`).

---

## Multi-business routing

Route different signal types to different people or Discord channels:

```yaml
# config/businesses.yml
businesses:
  - id: pankaj-automation
    name: "Pankaj — n8n & Bots"
    services: [n8n automation, Discord bots, AI agents, workflow automation]
    buying_signals: [n8n, automation, discord bot, zapier, make.com, webhook]
    contact:
      discord_webhook: "https://discord.com/api/webhooks/..."

  - id: agency-dev
    name: "Team — Full-stack Dev"
    services: [React, Node.js, SaaS MVP, API development]
    buying_signals: [SaaS, MVP, full stack, react developer, backend]
    contact:
      discord_webhook: "https://discord.com/api/webhooks/..."
```

Each person/channel only gets signals matched to their niche.

---

## MCP server — use inside Claude Code

Signal Hunter exposes itself as an [MCP server](https://modelcontextprotocol.io) so you can manage leads directly from your AI coding assistant.

Add to `~/.claude/claude_desktop_config.json` (or equivalent):

```json
{
  "mcpServers": {
    "signal-hunter": {
      "command": "signal-hunter-mcp"
    }
  }
}
```

Available tools: `scan_signals`, `list_signals`, `get_signal`, `mark_signal`

Then in Claude: *"Scan for new leads and show me everything above 75 from Upwork"*

---

## Project structure

```
signal-hunter/
├── bin/cli.js                  CLI entry + command dispatcher
├── src/
│   ├── commands/
│   │   ├── scan.js             Main scanner — dynamic source dispatch + priority queue
│   │   ├── list.js             Pipeline viewer
│   │   ├── insights.js         Source performance + learning stats
│   │   ├── reply/manage.js     reply / skip / open — calls outreach agent
│   │   ├── auth.js             OAuth2 browser flow (Upwork, Freelancer)
│   │   ├── cron.js             Scheduler — start/stop/status/logs/install (all OS)
│   │   ├── setup.js            Full onboarding wizard
│   │   ├── doctor.js           Health check
│   │   └── update.js           Self-updater (git pull + npm install)
│   ├── daemon.js               Background cron daemon (node-cron)
│   └── mcp-server.js           MCP server
├── agents/
│   ├── qualifier.js            AI scoring engine — multi-LLM + learning context
│   ├── outreach.js             End-to-end outreach generator (message + follow-up + proposal)
│   ├── learner.js              Self-learning: records reply/skip → improves future scoring
│   └── router.js               Multi-business notification routing
├── sources/
│   ├── dispatch.js             Plugin dispatcher — type field routes to provider
│   ├── providers/
│   │   ├── rss.js              Generic RSS/Atom (any feed, url_env, auth headers)
│   │   └── json_api.js         Generic JSON API (field mapping, env var interpolation)
│   ├── hackernews.js           HN Firebase + Algolia search
│   ├── reddit.js               Reddit Atom RSS (www.reddit.com links)
│   ├── remoteok.js             Remote OK open API
│   ├── remotive.js             Remotive.com free API
│   ├── devto.js                Dev.to Forem API
│   ├── upwork.js               Upwork OAuth2 GraphQL API
│   ├── freelancer.js           Freelancer.com API (config-driven skill IDs)
│   ├── websearch.js            Brave Search / Serper.dev
│   ├── twitter.js              Twitter/X bearer token
│   └── custom.js               Jina.ai reader for any URL
├── integrations/
│   └── discord-webhook.js      Discord embed with copy-paste outreach
├── utils/
│   ├── platform.js             Cross-platform: openBrowser, killProcess, paths (Win/Mac/Linux)
│   ├── store.js                Atomic writes — signals.json, seen-ids.json
│   ├── env-writer.js           Atomic .env key upsert (OAuth token persistence)
│   ├── config.js               YAML config loader
│   ├── paths.js                PKG_DIR / DATA_DIR — platform-aware defaults
│   └── logger.js               Rotating file logger
└── config/
    ├── profile.example.yml     Your identity, services, signal config, sources
    ├── businesses.example.yml  Multi-business routing
    └── sources.example.yml     All provider types with full documentation
```

---

## Installing on a remote machine / VPS

```bash
# Clone and install
git clone https://github.com/loondx/signal-hunter.git ~/.signal-hunter
cd ~/.signal-hunter
npm install --omit=dev

# Add to PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
mkdir -p ~/.local/bin
cat > ~/.local/bin/signal-hunter << 'EOF'
#!/usr/bin/env bash
exec node "$HOME/.signal-hunter/bin/cli.js" "$@"
EOF
chmod +x ~/.local/bin/signal-hunter
source ~/.bashrc

# Configure and run
signal-hunter setup
signal-hunter cron start --interval 30m
```

## Keeping it updated

```bash
signal-hunter update    # git pull + npm install — takes 10 seconds
```

Or if running as PM2:
```bash
signal-hunter update && pm2 restart signal-hunter
```

---

## Uninstall

**macOS / Linux:**
```bash
bash ~/.signal-hunter/uninstall.sh
```

**Windows:**
```powershell
& "$env:APPDATA\signal-hunter\uninstall.ps1"
```

---

## Contributing

Contributions welcome. Good areas:

- **New source providers** — any platform with a public API or RSS: `sources/providers/` is plugin-based, one file per source
- **New LLM providers** — add a `callXxx()` function in `agents/qualifier.js`
- **Better pre-filter** — improve competitor detection or intent signal detection in `agents/qualifier.js`
- **Email digest** — daily summary of saved signals
- **Tests** — unit tests for qualifier, pre-filter, provider parsing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

Built by freelancers, for freelancers. If Signal Hunter got you a client, drop a ⭐

**[Issues](https://github.com/loondx/signal-hunter/issues) · [Discussions](https://github.com/loondx/signal-hunter/discussions) · [npm](https://www.npmjs.com/package/signal-hunter)**

</div>
