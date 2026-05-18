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

Signal Hunter watches Reddit, Hacker News, and Remote OK for moments where someone publicly expresses a need your business can solve — **before they ever post a hiring ad**.

```
Signal Hunter found 3 new signals while you slept:

  [87] 🔥 Reddit r/webdev — "Our Zapier workflows keep breaking, losing hours/week"
       → Someone frustrated with automation. Budget signals present. Respond today.

  [74] 📌 Reddit r/smallbusiness — "Looking for someone to build a Discord bot for our community"
       → Clear request, explicit scope. Good fit for Discord bot dev services.

  [68] ·  Hacker News — "How do I connect Airtable to Slack without Zapier?"
       → DIY question that often converts to "just hire someone". Worth monitoring.
```

```bash
$ signal-hunter list

  Signal Hunter — Pipeline
  3 signal(s)

  [ 87] 🔥  Reddit r/webdev           new    2026-05-19
            Our Zapier workflows keep breaking, losing us hours every week…
            ↳ Explicit automation pain point with budget signals — strong lead.
            💰 ~$300/month Zapier spend currently

  [ 74] 📌  Reddit r/smallbusiness    new    2026-05-19
            Looking for someone to build a Discord bot for our community…
```

---

## Why this exists

I was manually scanning Reddit, Hacker News, and job boards every morning looking for freelance leads. After building this, the agent does it for me every 30 minutes — and only surfaces the ones worth reading.

**The difference:** Traditional job boards surface demand *after* it's public. Signal Hunter catches intent signals *as they appear* — someone complaining about broken automation, asking how to connect their tools, or explicitly posting "looking for a developer." You respond first.

---

## Quick Start

**One command** — installs to `~/.signal-hunter`, adds `signal-hunter` to your PATH:

```bash
curl -fsSL https://raw.githubusercontent.com/loondx/signal-hunter/main/install.sh | bash
```

Then follow the prompts:

```bash
signal-hunter setup     # 2-minute wizard — API key, sources, notifications
signal-hunter doctor    # verify everything is working
signal-hunter scan      # find your first signals
```

> **No account. No server. No credit card.** Works on any machine or VPS with Node.js 20+.
> Each user installs their own instance — your data never leaves your machine.

### Manual install (alternative)

```bash
git clone https://github.com/loondx/signal-hunter ~/.signal-hunter
cd ~/.signal-hunter && npm install
~/.signal-hunter/bin/cli.js setup
```

### Update

```bash
signal-hunter update    # pulls latest code from GitHub
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Intent Detection** | AI scores buying intent 0–100 — not keyword matching |
| **Multi-Source** | Reddit (RSS), Hacker News, Remote OK, Twitter/X, custom URLs |
| **Zero-Token Scan** | Sources fetched without AI — LLM only runs on matched candidates |
| **Multi-Business Routing** | Route signals to the right person in your team via `businesses.yml` |
| **Built-in Scheduler** | `cron start` — background daemon, survives terminal close |
| **MCP Server** | Use Signal Hunter directly inside Claude Code, Cursor, VS Code |
| **Discord / Email** | Webhook notification when high-score signal found |
| **Private by Default** | Config, leads, API keys never leave your machine |
| **Multi-LLM** | Gemini (free tier), OpenAI, Claude, or Ollama (local, free) |

---

## Installation

### Prerequisites

- Node.js 20+ — [nodejs.org](https://nodejs.org)
- An API key for one LLM (Gemini has a free tier — [aistudio.google.com](https://aistudio.google.com))

### Install globally (recommended)

```bash
npm install -g signal-hunter
signal-hunter setup
```

### Clone and run locally

```bash
git clone https://github.com/loondx/signal-hunter
cd signal-hunter
npm install
npm run setup      # or: node src/commands/setup.js
```

---

## Commands

```bash
signal-hunter setup              # Interactive setup wizard (run this first)
signal-hunter doctor             # Check config and API keys
signal-hunter scan               # Scan all sources for new signals
signal-hunter scan --source reddit        # Single source only
signal-hunter scan --source hackernews
signal-hunter scan --dry-run             # Qualify without saving
signal-hunter scan --min-score 30        # Override score threshold for this run
signal-hunter list                       # View pipeline sorted by score
signal-hunter list --min-score 70        # Filter by score
signal-hunter list --status new          # Filter by status
signal-hunter reply <num>                # Show outreach angle, mark replied
signal-hunter skip  <num>                # Hide from pipeline
signal-hunter open  <num>                # Open URL in browser
signal-hunter cron start                 # Start background scan daemon
signal-hunter cron start --interval 1h  # Custom interval
signal-hunter cron stop                  # Stop daemon
signal-hunter cron status                # Check if running
signal-hunter cron logs                  # Tail last 50 log lines
signal-hunter cron install               # Print crontab/PM2/systemd configs
```

---

## Configuration

### Your Profile (`config/profile.yml`)

The entire system is driven by your profile. Plain English — the AI reads it.

```yaml
identity:
  name: "Your Name"
  type: freelancer      # freelancer | agency | both

services:
  what_you_do: "Discord bots, n8n automation, AI integrations"

  # Describe the PAIN your clients have — not your skills
  buying_signals: >
    People frustrated with broken Zapier workflows.
    Communities needing Discord bots for moderation.
    Startups wanting to add AI without months of dev work.

  red_flags:
    - equity only
    - blockchain
    - unpaid test

llm:
  provider: gemini        # gemini | openai | claude | ollama
  model: gemini-flash-latest
  min_score: 40           # only save signals scoring above this

sources:
  enabled:
    - hackernews
    - reddit
    - remoteok
  reddit:
    subreddits:
      - forhire
      - hiring
      - smallbusiness
      - webdev

notifications:
  discord_webhook: ""     # paste Discord webhook URL — no bot setup needed
  notify_min_score: 65    # only notify for strong signals
```

### Partner Businesses (`config/businesses.yml`)

Route signals to the right person across your team or friend network:

```yaml
businesses:
  - id: pankaj
    name: "Pankaj — Automation & Bots"
    contact:
      discord_webhook: "https://discord.com/api/webhooks/..."
    buying_signals:
      - people needing Discord bots
      - automation and workflow help

  - id: alex-devops
    name: "Alex — DevOps"
    contact:
      email: alex@example.com
    buying_signals:
      - deployment issues
      - Kubernetes help
```

Each person only gets notified about their signals. One shared agent, private routing.

---

## Sources

| Source | Auth | Cost | Notes |
|--------|------|------|-------|
| Reddit | None | Free | Public RSS via `old.reddit.com` — works from any IP |
| Hacker News | None | Free | Job stories + Algolia search |
| Remote OK | None | Free | Open JSON API |
| Twitter / X | Bearer token | Free tier | 500k tweets/month |
| Custom URLs | None | Free | Any webpage via Jina.ai reader |

---

## LLMs

| Provider | Model | Cost | Notes |
|----------|-------|------|-------|
| Google Gemini | `gemini-flash-latest` | Free tier | Best for getting started |
| OpenAI | `gpt-4o-mini` | ~$0.01/1k signals | Fast |
| Anthropic Claude | `claude-haiku-4-5-20251001` | ~$0.01/1k signals | Excellent reasoning |
| Ollama | `llama3.2` | Free | Runs locally, 100% private |

---

## MCP Server — use inside Claude Code / Cursor

Signal Hunter exposes itself as an [MCP server](https://modelcontextprotocol.io), so your AI assistant can call it directly.

**Claude Desktop** — add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "signal-hunter": {
      "command": "signal-hunter-mcp"
    }
  }
}
```

**Or with a local clone:**

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

Now ask Claude: *"Scan for new leads and show me anything above 70"* — from inside your editor.

---

## Automation (VPS / Server)

```bash
# Recommended: PM2 (auto-restart on crash)
npm install -g pm2
pm2 start src/daemon.js --name signal-hunter -- --interval 30m
pm2 save && pm2 startup

# Or: built-in daemon
signal-hunter cron start --interval 30m

# Or: crontab (most portable)
signal-hunter cron install    # prints the exact line to add
```

---

## Project Structure

```
signal-hunter/
├── bin/
│   └── cli.js             ← CLI entry point + command dispatcher
├── src/
│   ├── commands/
│   │   ├── scan.js        ← Main scanner
│   │   ├── list.js        ← Pipeline viewer
│   │   ├── cron.js        ← Cron management (start/stop/status/logs)
│   │   ├── manage.js      ← reply / skip / open
│   │   ├── doctor.js      ← Health check
│   │   ├── setup.js       ← Setup wizard
│   │   └── update.js      ← Self-updater
│   ├── daemon.js          ← Background scan daemon
│   └── mcp-server.js      ← MCP server (Claude Code, Cursor, VS Code)
├── agents/
│   ├── qualifier.js       ← AI scoring engine (multi-LLM)
│   └── router.js          ← Multi-business notification routing
├── sources/
│   ├── hackernews.js      ← HN job stories + Algolia search
│   ├── reddit.js          ← Reddit RSS (no auth needed)
│   ├── remoteok.js        ← Remote OK open API
│   ├── twitter.js         ← Twitter/X (requires bearer token)
│   └── custom.js          ← Any URL via Jina.ai
├── integrations/
│   └── discord-webhook.js ← Discord webhook sender
├── utils/
│   ├── args.js            ← CLI argument parser
│   ├── config.js          ← YAML config loader
│   ├── store.js           ← Signal pipeline (JSON store)
│   ├── paths.js           ← PKG_DIR / DATA_DIR resolver
│   └── logger.js          ← Async file logger
└── config/
    ├── profile.example.yml
    ├── businesses.example.yml
    └── sources.example.yml
```

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

**Good first issues:**
- Adding a new source (LinkedIn public search, Wellfound, Indie Hackers)
- Adding a new LLM provider
- Improving the pre-filter accuracy
- Adding email digest integration

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**If Signal Hunter found you a client, drop a ⭐ — it helps others find the project.**

</div>
