<div align="center">

# 🎯 Signal Hunter

**AI agent that finds clients before they post a job listing.**

[![npm version](https://img.shields.io/npm/v/signal-hunter?color=brightgreen)](https://www.npmjs.com/package/signal-hunter)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/loondx/signal-hunter/actions/workflows/ci.yml/badge.svg)](https://github.com/loondx/signal-hunter/actions)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)

</div>

---

Job boards show you listings **200 people already applied to**.

Signal Hunter watches Reddit, Hacker News, Remote OK, and custom sources for moments where someone publicly expresses a pain your business can solve — before they ever post a job ad. The AI scores each one 0–100 for buying intent, tells you exactly what to say, and pings you on Discord when a strong one appears.

```
  [ 91] 🔥  Reddit r/smallbusiness     new    2026-05-19
            "We're drowning in manual Slack updates — paying $400/mo for Zapier
             and it still breaks every week…"
            ↳ Explicit automation pain + current spend = real budget. High urgency.
            💰 ~$400/month current Zapier spend
            ✉  "I rebuilt a similar Zapier flow in n8n for a SaaS team last month
                and cut their cost to zero — happy to show you what that looks like."

  [ 78] 📌  HN — Who's Hiring?         new    2026-05-19
            "Contractor wanted — Discord bot for 50k member community, $2–5k budget"
            ↳ Explicit budget, explicit scope. Apply today.
            💰 $2,000 – $5,000
```

---

## How it works

1. Every 30 minutes: fetches posts from Reddit, Hacker News, Remote OK (no auth needed)
2. Pre-filter rejects obvious mismatches instantly — zero AI cost
3. Remaining candidates are scored by an LLM against your profile
4. Anything above your threshold is saved, and you get a Discord ping
5. You run `signal-hunter reply <num>` — it shows the post + a personalised outreach opener
6. You reply within the hour. You win the client.

---

## Quick Start

```bash
# One command — installs to ~/.signal-hunter, adds signal-hunter to PATH
curl -fsSL https://raw.githubusercontent.com/loondx/signal-hunter/main/install.sh | bash
```

```bash
signal-hunter setup     # 2-minute wizard: API key, sources, notifications
signal-hunter doctor    # verify everything works
signal-hunter scan      # find your first signals
```

> **No account. No server. No credit card.**  
> Everything runs on your own machine. Your data stays local.

**Or install via npm:**

```bash
npm install -g signal-hunter
signal-hunter setup
```

---

## The Signal Quality Playbook

> The tool is only as good as your profile. Most people write vague signals and get vague leads. This section is the most important thing to read.

### Write signals as client pain — not your skills

The AI reads your profile in plain English. Describe the problems your clients have, not what you can do.

❌ **Weak — produces noise:**
```yaml
services:
  what_you_do: "I do automation, Discord bots, AI stuff"
  buying_signals: "people who need bots or automation"
```

✅ **Strong — produces real leads:**
```yaml
services:
  what_you_do: "Discord bots and n8n workflow automation for startups and communities"

  buying_signals: >
    People saying their Zapier or Make workflows keep breaking or are too expensive.
    Community owners who need a Discord bot for welcome messages, role assignment,
    moderation, or engagement — and don't want to pay $50/month for a SaaS bot.
    Startups doing repetitive data entry or status updates manually across Notion,
    Slack, Airtable, or Google Sheets.
    Anyone asking how to connect two specific tools without code.

  red_flags:
    - equity only
    - revenue share
    - unpaid test project
    - "small budget"
    - blockchain / crypto / web3 / NFT
    - looking for co-founder
    - needs full-time commitment
```

### Set a high score threshold

Start at `min_score: 70`. Drop it later if volume is too low — never lower than 60.

```yaml
llm:
  min_score: 70       # don't review below this
notifications:
  notify_min_score: 80  # only ping Discord for the strongest ones
```

### Pick the right subreddits

These produce the highest-quality leads consistently:

```yaml
sources:
  reddit:
    subreddits:
      # High intent — people actively looking to hire
      - forhire
      - hiring

      # Problem signals — people with pain you can solve
      - smallbusiness
      - entrepreneur
      - startups
      - SaaS

      # Tech-specific pain signals
      - webdev
      - nocode
      - zapier
      - n8n

      # Community-specific (add your niche)
      - discordapp      # "we need a bot for our server"
      - discord
```

### Add LinkedIn jobs via custom URLs

LinkedIn's public job search pages can be monitored for freelance/contract work. Add to `config/sources.yml`:

```yaml
sources:
  custom_urls:
    enabled: true
    urls:
      # Freelance/contract Discord bot work posted in last 24h
      - url: "https://www.linkedin.com/jobs/search/?keywords=discord+bot+freelance&f_TP=1&f_JT=C"
        label: "LinkedIn — Discord Bot (Contract)"
        scan_interval: 120

      # n8n / automation contractor roles
      - url: "https://www.linkedin.com/jobs/search/?keywords=n8n+automation&f_TP=1&f_JT=C"
        label: "LinkedIn — Automation (Contract)"
        scan_interval: 120

      # We Work Remotely freelance section
      - url: "https://weworkremotely.com/categories/remote-programming-jobs"
        label: "We Work Remotely"
        scan_interval: 60

      # Remotive freelance listings
      - url: "https://remotive.com/remote-jobs/software-dev"
        label: "Remotive"
        scan_interval: 60
```

> LinkedIn pages are public but may load inconsistently. If a URL returns empty results, try the `/jobs/freelance-jobs/` path or search by keyword.

---

## Daily Workflow to Win Clients

This is the exact routine. The whole thing takes 15–20 minutes a day.

### Morning review (5 min)

```bash
signal-hunter list --min-score 75 --status new
```

Look at the top 3–5 signals. Skip anything below 75 unless the description jumps out.

### For each strong signal (3–5 min each)

```bash
signal-hunter reply 4    # shows full post + AI outreach opener
signal-hunter open 4     # opens original URL in browser
```

Read the **original post** in full. The outreach opener is a starting point — you must personalise it with something specific from their post. One sentence of personalisation beats a perfect template.

### The reply formula that converts

```
Hi [name],

[One sentence showing you read their specific post — mention their exact tool/problem.]

[One sentence about something directly relevant you've built before.]

[Soft ask — not "hire me", but something useful: a loom video, a 15-min call, or just a helpful answer to their question.]
```

**Example — from the Zapier signal above:**

> Hey, saw your post about the Zapier workflows breaking. I rebuilt almost the exact same setup (Slack + Airtable + webhook chain) in n8n for a SaaS team last month — their cost went from $400/mo to zero and it hasn't broken since. Happy to share a quick Loom of how it's structured if useful, no strings.

Keep it under 5 sentences. Never pitch your services upfront.

### LinkedIn cross-reference (2 min per lead)

When a Reddit or HN post has a username or company name:

1. Search for them on LinkedIn
2. Connect with a personalised note that references their post — don't copy your reply, write something shorter:
   > *"Saw your post on r/smallbusiness about the Zapier costs — connected because I've solved exactly that problem. Happy to share what worked."*
3. This turns an anonymous internet comment into a warm connection

This step alone doubles conversion rate because most people never bother.

### Mark your pipeline

```bash
signal-hunter reply 4    # auto-marks as replied after you view it
signal-hunter skip 7     # hide signals you won't pursue
```

---

## Automation — run it while you sleep

### Recommended: built-in daemon

```bash
signal-hunter cron start --interval 30m    # runs every 30 minutes in background
signal-hunter cron status                  # check it's running
signal-hunter cron stop                    # stop it
```

### VPS / server (survives reboots)

```bash
# PM2 — auto-restarts on crash, survives reboots
npm install -g pm2
pm2 start src/daemon.js --name signal-hunter -- --interval 30m
pm2 save && pm2 startup

# Or: systemd / crontab — run: signal-hunter cron install
```

Set up a Discord webhook so you get pinged when a strong signal appears — you can reply within the hour without ever opening the terminal.

---

## Commands

```bash
# Setup
signal-hunter setup              # interactive wizard (run this first)
signal-hunter doctor             # check config, API keys, connectivity

# Scanning
signal-hunter scan               # scan all sources
signal-hunter scan --source reddit          # single source
signal-hunter scan --dry-run               # qualify without saving
signal-hunter scan --min-score 50          # lower threshold for this run only

# Pipeline
signal-hunter list                          # view all signals, sorted by score
signal-hunter list --min-score 75           # filter by score
signal-hunter list --status new             # filter: new | replied | skipped
signal-hunter list --source reddit          # filter by source
signal-hunter list --limit 10              # limit results

# Signal actions
signal-hunter reply <num>       # view full signal + outreach angle, mark replied
signal-hunter skip  <num>       # hide from pipeline
signal-hunter open  <num>       # open original URL in browser

# Scheduler
signal-hunter cron start                    # start background daemon (every 30m)
signal-hunter cron start --interval 1h     # custom interval: 30m, 1h, 6h, 1d
signal-hunter cron stop
signal-hunter cron status
signal-hunter cron logs
signal-hunter cron install                  # print crontab / PM2 / systemd config

# Maintenance
signal-hunter update             # pull latest from GitHub
signal-hunter version
```

---

## Configuration

### `config/profile.yml`

```yaml
version: "1"

identity:
  name: "Your Name"
  type: freelancer      # freelancer | agency | both

services:
  what_you_do: "Discord bots, n8n automation, AI integrations"
  buying_signals: >
    Plain English description of your clients' pain — not your skills.
    The more specific, the better the signal quality.
  red_flags:
    - equity only
    - blockchain
    - unpaid test
  budget_min: "$500"

llm:
  provider: gemini      # gemini | openai | claude | ollama
  model: gemini-flash-latest
  min_score: 70         # 60 = decent, 70 = good, 80 = strong

sources:
  enabled:
    - hackernews
    - reddit
    - remoteok
  reddit:
    subreddits:
      - forhire
      - smallbusiness
      - webdev

notifications:
  discord_webhook: ""   # paste a Discord webhook URL — no bot setup needed
  notify_min_score: 80  # only ping for strong signals
```

### `config/businesses.yml` — multi-business routing

Route signals to different people in your team or partner network:

```yaml
businesses:
  - id: pankaj
    name: "Pankaj — Automation & Bots"
    contact:
      discord_webhook: "https://discord.com/api/webhooks/..."
    buying_signals:
      - people needing Discord bots
      - n8n and workflow automation

  - id: alex
    name: "Alex — DevOps"
    contact:
      discord_webhook: "https://discord.com/api/webhooks/..."
    buying_signals:
      - deployment and CI/CD help
      - Kubernetes and infrastructure
```

Each person only gets notified about signals relevant to them.

---

## Sources

| Source | Auth | Cost | Notes |
|--------|------|------|-------|
| Reddit | None | Free | Public RSS — works from any IP, no rate limits |
| Hacker News | None | Free | Monthly "Who is Hiring?" + Algolia keyword search |
| Remote OK | None | Free | Open JSON API |
| Twitter / X | Bearer token | Free tier | 500k tweet reads/month |
| Custom URLs | None | Free | Any public webpage via Jina.ai reader |

---

## LLMs

| Provider | Model | Cost | Notes |
|----------|-------|------|-------|
| Google Gemini | `gemini-flash-latest` | Free tier | Best to start — generous free quota |
| OpenAI | `gpt-4o-mini` | ~$0.01/1k signals | Fast and reliable |
| Anthropic Claude | `claude-haiku-4-5-20251001` | ~$0.01/1k signals | Best reasoning |
| Ollama | `llama3.2` | Free | Runs locally — 100% private, no API key |

---

## MCP Server — use inside Claude Code / Cursor

Signal Hunter exposes itself as an [MCP server](https://modelcontextprotocol.io) so your AI assistant can scan and manage signals directly.

**Claude Desktop / Claude Code** — add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "signal-hunter": {
      "command": "signal-hunter-mcp"
    }
  }
}
```

**Local clone:**

```json
{
  "mcpServers": {
    "signal-hunter": {
      "command": "node",
      "args": ["/absolute/path/to/signal-hunter/src/mcp-server.js"]
    }
  }
}
```

Available tools: `scan_signals`, `list_signals`, `get_signal`, `mark_signal`

Then ask Claude: *"Scan for new leads and show me anything above 75"*

---

## Project Structure

```
signal-hunter/
├── bin/cli.js             ← CLI entry point + command dispatcher
├── src/
│   ├── commands/
│   │   ├── scan.js        ← Main scanner + runScan() export
│   │   ├── list.js        ← Pipeline viewer
│   │   ├── cron.js        ← Cron management (start/stop/status/logs)
│   │   ├── manage.js      ← reply / skip / open
│   │   ├── doctor.js      ← Health check
│   │   ├── setup.js       ← Setup wizard
│   │   └── update.js      ← Self-updater
│   ├── daemon.js          ← Background scan daemon (node-cron)
│   └── mcp-server.js      ← MCP server
├── agents/
│   ├── qualifier.js       ← AI scoring engine (multi-LLM)
│   └── router.js          ← Multi-business notification routing
├── sources/
│   ├── hackernews.js      ← HN job stories + Algolia search
│   ├── reddit.js          ← Reddit RSS (no auth)
│   ├── remoteok.js        ← Remote OK open API
│   ├── twitter.js         ← Twitter/X bearer token
│   └── custom.js          ← Any URL via Jina.ai
├── integrations/
│   └── discord-webhook.js
├── utils/
│   ├── args.js            ← CLI argument parser
│   ├── config.js          ← YAML config loader
│   ├── store.js           ← Signal pipeline (JSON)
│   ├── paths.js           ← PKG_DIR / DATA_DIR resolver
│   └── logger.js          ← File logger
└── config/
    ├── profile.example.yml
    ├── businesses.example.yml
    └── sources.example.yml
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues: new sources (Wellfound, Indie Hackers, Slack job boards), new LLM providers, email digest, improved pre-filter logic.

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**If Signal Hunter found you a client, drop a ⭐ — it helps others find the project.**

</div>
