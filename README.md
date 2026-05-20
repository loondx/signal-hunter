<div align="center">

<h1>🎯 Signal Hunter</h1>

<p><strong>AI agent that finds paying clients before they post a job listing.</strong></p>

<p>
  <a href="https://www.npmjs.com/package/signal-hunter"><img src="https://img.shields.io/npm/v/signal-hunter?color=brightgreen&style=flat-square" alt="npm"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square" alt="Node.js"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" alt="Platforms">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT"></a>
</p>

</div>

---

Job boards show you listings **200 people already applied to.**

Signal Hunter watches Reddit, Hacker News, Remotive, Remote OK, Dev.to, GitHub Issues, Upwork, Freelancer.com — and the whole internet — for the moment someone publicly describes a problem you can solve. The AI scores each post 0–100, filters out job seekers and noise, pings you on Discord the second a real lead appears, and generates a full ready-to-send outreach message so you can reply first.

```
  [95] 🔥  Upwork                       new    2026-05-21
           "Need n8n automation expert — webhook pipeline from Stripe to
            Notion to Slack. Budget $800–1200. Start ASAP."
           ↳ Explicit budget + scope + urgency. Apply today.
           💰 $800 – $1,200 fixed

  [88] 📌  Reddit r/SaaS                new    2026-05-21
           "Our team spends 3h/day copying data between Airtable and HubSpot.
            Looking for a contractor to automate this — $500–800 budget."
           ↳ Quantified pain + budget + contractor intent. Strong lead.
           💰 $500 – $800

  [81] 📌  Hacker News — Who's Hiring?  new    2026-05-21
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
  setup for a SaaS team last month in about 4 hours. Happy to share
  a quick Loom of how it's structured, or sketch the architecture
  for your use case before you commit.

  ──────────────────────────────────────────────────────────────
  💪 Your edge: Direct n8n experience with this exact Stripe → Notion pattern

  🔁 Follow-up (day 3–4 if no response):
  Still open on the automation project? Happy to send over a quick
  architecture sketch — takes me 10 minutes and gives you a clear
  picture of what's involved.
```

---

## What makes it different

| | |
|---|---|
| **Finds leads before job boards** | Scans Reddit, HN comments, and dev communities — where clients describe pain *before* they know to post a job. |
| **Filters job seekers automatically** | Detects `[FOR HIRE]` posts and people looking for work before spending any AI credits. You only see clients, not competition. |
| **Only contract and freelance work** | Remotive and Remote OK are pre-filtered to contract/freelance tech roles. Full-time listings never reach the AI. |
| **Prioritises job boards in the AI queue** | Upwork and Freelancer.com score before Reddit discussions. Real projects with budgets get your attention first. |
| **Gets smarter every reply** | Every `reply` and `skip` updates a local learning file. The AI prompt gets personalised context from your own history — which sources convert, which keywords matter to you. |
| **Generates the full outreach** | `signal-hunter reply N` produces a complete package: copy-paste message, platform send instructions, day-4 follow-up, proposal opener, and scope questions. |
| **Plugin-based — zero code to extend** | Add any RSS feed, JSON API, or webpage as a source in `sources.yml`. No code changes needed. |
| **Everything stays local** | No account. No cloud. No credit card. Config, signals, and tokens live on your machine. |

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

### npm (any OS)
```bash
npm install -g signal-hunter
```

> **Requires Node.js 20+.** The shell installers auto-install Node.js if missing (Homebrew / nvm / winget).

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

  1. Fetch  →  Reddit RSS, HN Algolia, Remotive API (contract/freelance only),
               Remote OK (contract/freelance only), Dev.to API, GitHub Issues,
               Upwork GraphQL, Freelancer.com API, web search, custom RSS/JSON

  2. Filter →  Kill job-seeker posts ("[FOR HIRE]", "available for hire") — no AI call
               Kill red flags (crypto, gambling, equity-only) — no AI call

  3. Sort   →  Job boards first (Upwork=110, Remotive=100, HN Jobs=92)
               then community posts (Reddit forhire=65, general Reddit=30)

  4. Score  →  AI rates top N candidates 0–100 for buying intent
               Injects learned patterns from your reply/skip history

  5. Save   →  Signals above min_score go to your pipeline
               Signals above notify_score ping Discord immediately

  6. Reply  →  signal-hunter reply N  →  full AI outreach package
```

---

## Quick Start

```bash
# 1. Install
curl -fsSL https://raw.githubusercontent.com/loondx/signal-hunter/main/install.sh | bash

# 2. Set up (3 minutes)
signal-hunter setup

# 3. Check everything works
signal-hunter doctor

# 4. First scan
signal-hunter scan

# 5. View your pipeline
signal-hunter list

# 6. Act on a lead
signal-hunter reply 1

# 7. Automate it
signal-hunter cron start
```

---

## Commands

### Setup
```bash
signal-hunter setup                    # interactive wizard — run this first
signal-hunter doctor                   # check config, API keys, connectivity
signal-hunter doctor --test-discord    # send a test ping to your Discord channel
signal-hunter auth upwork              # connect Upwork via browser OAuth2 flow
signal-hunter auth freelancer          # connect Freelancer.com (guided token setup)
```

### Scanning
```bash
signal-hunter scan                     # scan all enabled sources
signal-hunter scan --source remotive   # scan a single source
signal-hunter scan --dry-run           # qualify without saving anything
signal-hunter scan --min-score 50      # override score threshold for this run
```

### Pipeline
```bash
signal-hunter list                     # view pipeline, sorted by score
signal-hunter list --min-score 75      # filter by minimum score
signal-hunter list --status new        # filter by status: new | replied | skipped
signal-hunter list --source remotive   # filter by source name
signal-hunter insights                 # source stats, score distribution, learning data
```

### Acting on leads
```bash
signal-hunter reply <num>              # AI outreach package — message, follow-up, proposal
signal-hunter skip  <num>              # hide from pipeline + update self-learning
signal-hunter open  <num>              # open original URL in your browser
```

### Automation
```bash
signal-hunter cron start               # start background daemon (uses interval from profile)
signal-hunter cron start --interval 30m   # override interval: 15m | 30m | 1h | 2h | 6h | 12h | 24h
signal-hunter cron stop                # stop the daemon
signal-hunter cron status              # is it running? last scan? next scan?
signal-hunter cron logs                # tail the scan log
signal-hunter cron install             # print crontab / Task Scheduler / launchd / PM2 config
```

### Maintenance
```bash
signal-hunter update                   # pull latest from GitHub + reinstall dependencies
signal-hunter version                  # show version + install path
```

---

## Sources

Signal Hunter is plugin-based — each source is an entry in `config/sources.yml`.

### Free (no credentials needed)

| Source | What you get |
|--------|-------------|
| **Reddit** | 30+ subreddits: r/forhire, r/freelance, r/startups, r/n8n, r/SaaS, r/AI_Agents… |
| **Hacker News** | "Who is Hiring?" monthly thread + Algolia keyword search |
| **Remotive** | Contract and freelance tech roles only — full-time listings pre-filtered out |
| **Remote OK** | Contract/freelance remote jobs — full-time posts filtered before AI |
| **Dev.to** | `#hiring`, `#webdev`, `#automation`, `#react`, `#ai` tags |
| **GitHub Issues** | Public repos: "looking for developer", "hire developer", "freelance" signals |
| **Any RSS feed** | Add any job board feed in `sources.yml` — no code needed |
| **Any JSON API** | Map any API response to signals — fully configurable field mapping |
| **Any webpage** | Jina.ai reader — IndieHackers, We Work Remotely, any site |

### Premium (credentials required)

| Source | Setup | What you get |
|--------|-------|-------------|
| **Upwork** | `signal-hunter auth upwork` | Real client projects with budgets, filtered by your search queries |
| **Freelancer.com** | `signal-hunter auth freelancer` | Active projects filtered by your skill IDs |
| **Web Search** | `SERPER_API_KEY` in `.env` (free 2,500 queries at serper.dev) | Entire internet searched for hiring-intent posts |

### Enable GitHub Issues (free, no token needed)

```yaml
# config/sources.yml
github:
  type: github
  enabled: true          # change false → true
  config:
    queries:
      - '"looking for developer" is:issue is:open'
      - '"hire developer" is:issue is:open'
      - '"automation developer" is:issue is:open'
    posts_per_scan: 15
```

> Add `GITHUB_TOKEN=ghp_...` to `.env` for 30 req/min instead of 10 (optional).

### Add any source without writing code

```yaml
# config/sources.yml

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

# Any webpage (via Jina reader)
indiehackers:
  type: jina
  enabled: true
  config:
    url: "https://www.indiehackers.com/jobs"
    label: "IndieHackers Jobs"
```

---

## Configuration

### `config/profile.yml`

The AI reads your profile in plain English. **Describe client pain, not your skills.**

```yaml
version: "1"

identity:
  name: "Your Name"
  type: freelancer            # freelancer | agency | both

services:
  what_you_do: >-
    Full-stack AI engineer: React, Node.js, n8n automation, Discord bots,
    AI agents (Claude, OpenAI), SaaS MVP development, REST APIs, AWS serverless.

  # Describe the PAIN your clients have — not your CV
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
  provider: gemini            # gemini (free) | claude | openai | ollama
  model: gemini-flash-latest
  min_score: 55               # save signals above this score

sources:
  enabled:
    - hackernews
    - reddit
    - remoteok
    - remotive
    - devto
    - github                  # free — no token needed
    - upwork                  # after: signal-hunter auth upwork
    - freelancer              # after: signal-hunter auth freelancer

  reddit:
    subreddits:
      # Direct hire intent
      - forhire
      - freelance_forhire
      - for_hire
      - hiring
      # Clients with budgets
      - startups
      - SaaS
      - Entrepreneur
      - smallbusiness
      - indiehackers
      # Niche signals
      - n8n
      - automation
      - nocode
      - AI_Agents
      - webdev

notifications:
  discord_webhook: "https://discord.com/api/webhooks/..."
  notify_min_score: 65        # ping on Discord for this score and above
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
  Discord bots and n8n workflow automation for startups and communities —
  replacing broken Zapier flows and expensive SaaS subscriptions.

buying_signals: >-
  Zapier or Make workflows that keep breaking or got too expensive.
  Community owners needing a welcome bot, role assignment, or moderation.
  Startups doing manual copy-paste between Notion, Airtable, Slack, or Google Sheets.
  Anyone asking how to connect two tools without code.
```

---

## Self-learning

Every action you take trains the agent. No config needed.

```bash
signal-hunter reply 3    # records: this source + score + keywords were worth my time
signal-hunter skip 7     # records: this type of signal is not worth my time
```

After a few replies and skips, the AI qualifier prompt automatically includes:

```
LEARNED PATTERNS (12 replied, 8 skipped):
- Source reply rates: Upwork: 80%, Remotive: 60%, Reddit r/webdev: 10%
- Avg score of signals you actually replied to: 74/100
- Keywords common in your replies: n8n, automation, webhook, budget, urgent, api
- Keywords common in signals you skipped: how do i, tutorial, free, help me understand
```

View your learning data:
```bash
signal-hunter insights
```

---

## Discord notifications

Every strong signal pings your Discord with a formatted embed:

- **Score and urgency** — `🔥 HOT LEAD → respond TODAY`
- **Source** — where it was found
- **Their post** — first 400 characters
- **AI reasoning** — why this scored high, in one sentence
- **Budget signal** — extracted if mentioned
- **Copy & Send** — outreach angle in a code block

Setup: Discord server → Edit channel → Integrations → Webhooks → New Webhook → Copy URL → add to `.env`:

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Test it:
```bash
signal-hunter doctor --test-discord
```

---

## LLMs

| Provider | Model | Cost | Notes |
|----------|-------|------|-------|
| **Google Gemini** | `gemini-flash-latest` | Free tier (15 RPM) | Best to start |
| **Anthropic Claude** | `claude-haiku-4-5-20251001` | ~$0.01 / 50 signals | Best reasoning |
| **OpenAI** | `gpt-4o-mini` | ~$0.01 / 50 signals | Fast, reliable |
| **Ollama** | `llama3.2` | Free | 100% local, no API key |

Set in `config/profile.yml`:
```yaml
llm:
  provider: gemini
  model: gemini-flash-latest
```

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

Each person or channel only gets signals matched to their niche.

---

## Automation

### Built-in daemon
```bash
signal-hunter cron start                    # uses interval from profile (set during setup)
signal-hunter cron start --interval 30m    # override: 15m | 30m | 1h | 2h | 6h | 12h | 24h
signal-hunter cron status
signal-hunter cron stop
```

### OS-native scheduling
```bash
signal-hunter cron install    # prints setup for your OS
```

Prints instructions for:
- **Windows** — Task Scheduler `Register-ScheduledTask` commands
- **macOS** — launchd plist for `~/Library/LaunchAgents/`
- **Linux** — systemd unit file + crontab one-liner
- **All** — PM2 commands for crash recovery and boot persistence

### PM2 (recommended for reliability)
```bash
npm install -g pm2
pm2 start "signal-hunter" --name signal-hunter -- cron start
pm2 save && pm2 startup
```

### VPS / remote server
```bash
git clone https://github.com/loondx/signal-hunter.git ~/.signal-hunter
cd ~/.signal-hunter && npm install --omit=dev
mkdir -p ~/.local/bin
printf '#!/usr/bin/env bash\nexec node "$HOME/.signal-hunter/bin/cli.js" "$@"\n' > ~/.local/bin/signal-hunter
chmod +x ~/.local/bin/signal-hunter
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
signal-hunter setup
signal-hunter cron start --interval 30m
```

---

## Keeping it updated

```bash
signal-hunter update    # git pull + npm install — takes ~10 seconds
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

Good areas:

- **New source providers** — any platform with a public API or RSS: add one file in `sources/` and register it in `sources/dispatch.js`
- **New LLM providers** — add a `callXxx()` function in `agents/qualifier.js`
- **Better pre-filter** — improve competitor detection or intent signal detection
- **Email digest** — daily summary of saved signals
- **Tests** — unit tests for qualifier, pre-filter, provider parsing

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

Built by freelancers, for freelancers. If Signal Hunter got you a client, drop a ⭐

**[Issues](https://github.com/loondx/signal-hunter/issues) · [Discussions](https://github.com/loondx/signal-hunter/discussions) · [npm](https://www.npmjs.com/package/signal-hunter)**

</div>
