# Signal Hunter 🎯

> AI agent that hunts buying signals across the internet — before clients post a job listing.

Companies use AI to filter candidates. **Now freelancers and service businesses have AI to find clients.**

```
Signal Hunter found 3 new signals while you were sleeping:

  [94] Reddit r/webdev — "our n8n workflows keep breaking, we're losing hours every week"
  [87] HN comments  — "looking for someone to build a Discord community bot for our startup"  
  [71] Remote OK    — "automation engineer needed, budget $3k-5k, urgent"

Run `signal-hunter list` to view full details and draft outreach.
```

---

## Why this is different from job boards

Job boards show you listings that 200 people already applied to.

Signal Hunter watches for **buying intent** — moments where someone publicly expresses a need your business can solve, before they even know they're looking to hire:

- Someone on Reddit: *"our Zapier setup is a mess, we're wasting hours every week"*
- Someone on HN: *"looking for a contractor to build our Discord community tools"*
- Someone on Twitter: *"anyone know a good n8n developer? zapier is getting too expensive"*

The AI understands **intent**, not just keywords. It reads these signals against your profile and scores them. You see only the ones worth your time.

---

## Features

| Feature | Description |
|---------|-------------|
| **Intent Detection** | AI scores buying intent against your service profile — not keyword matching |
| **Multi-Source** | Reddit, Hacker News, Remote OK, Twitter/X, custom URLs |
| **Zero-Token Scanning** | Sources are fetched without AI — LLM only runs on matched candidates |
| **Multi-Business Routing** | Route signals to the right person in your network |
| **Discord / Email Notify** | Get notified when a strong signal is found — no bot setup needed |
| **Private by Default** | Your config, leads, and API keys never leave your machine |
| **Cron-Ready** | One line to automate: `*/30 * * * * signal-hunter scan` |
| **Open Source** | MIT license — fork, extend, self-host |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/yourusername/signal-hunter
cd signal-hunter

# 2. Install
npm install

# 3. Setup (2-minute wizard)
npm run setup

# 4. Health check
npm run doctor

# 5. Hunt
npm run scan
```

That's it. No account. No API. No server. Works on any machine with Node.js 20+.

---

## How it works

```
Your profile.yml
  └─ "I build Discord bots and automation tools"
  └─ "My clients struggle with manual workflows"

     ↓

Sources scan every 30 min (zero AI tokens)
  ├─ Reddit r/forhire, r/freelance, r/webdev...
  ├─ Hacker News "Who is Hiring?" + discussions
  └─ Remote OK open API

     ↓

AI Qualifier (only runs on candidates that pass keyword pre-filter)
  └─ Scores each signal 0-100 against your profile
  └─ Extracts: what they need, budget hints, urgency

     ↓

Your pipeline  (data/signals.md)
  └─ Sorted by score
  └─ Only signals above your threshold

     ↓

Notification (if score > notify_min_score)
  └─ Discord webhook  (no bot setup — just a URL)
  └─ Email digest     (optional)
```

---

## Configuration

### Your profile (`config/profile.yml`)

```yaml
identity:
  name: "Pankaj Kumar"
  type: freelancer

services:
  what_you_do: "Discord bots, n8n automation, AI integrations"
  buying_signals: >
    People with broken workflows, teams needing Discord bots,
    startups wanting to add AI without coding everything from scratch.
  red_flags:
    - equity only
    - blockchain
  budget_min: "$500"

llm:
  provider: gemini          # gemini (free) | openai | claude | ollama
  min_score: 60
```

### Partner businesses (`config/businesses.yml`)

Route signals to the right person in your network:

```yaml
businesses:
  - id: pankaj
    name: "Pankaj — Automation"
    contact:
      discord_webhook: "https://discord.com/api/webhooks/..."
    buying_signals:
      - people frustrated with manual workflows
      - needing Discord bot development

  - id: alex-devops
    name: "Alex — DevOps"
    contact:
      email: alex@example.com
    buying_signals:
      - deployment issues
      - looking for Kubernetes help
```

Each person gets notified only about **their** signals. One shared agent, private notifications.

---

## MCP Server — use Signal Hunter inside Claude Code / Cursor

Signal Hunter exposes itself as an [MCP server](https://modelcontextprotocol.io), so your AI coding assistant can call it directly.

**Claude Code / Claude Desktop** — add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "signal-hunter": {
      "command": "node",
      "args": ["/absolute/path/to/signal-hunter/mcp-server.mjs"]
    }
  }
}
```

After `npm install -g signal-hunter`:
```json
{
  "mcpServers": {
    "signal-hunter": { "command": "signal-hunter-mcp" }
  }
}
```

**Available MCP tools:**

| Tool | Description |
|------|-------------|
| `scan_signals` | Scan all sources and return new buying signals |
| `list_signals` | List pipeline filtered by score / status |
| `get_signal` | Full details + outreach angle for a signal |
| `mark_signal` | Update signal status (replied, skipped) |

Now you can ask Claude: *"Scan for new leads and show me anything above 80"* — right from your editor.

---

## Built-in scheduler

```bash
# Start background daemon (runs every 30 min, survives terminal close)
signal-hunter cron start

# Custom interval
signal-hunter cron start --interval 1h

# Check if running
signal-hunter cron status

# Stop it
signal-hunter cron stop

# Show setup instructions for crontab / PM2 / systemd
signal-hunter cron install
```

---

## Automating with cron

On a VPS or your local machine — run once, never miss a signal:

```bash
# Every 30 minutes
*/30 * * * * cd /path/to/signal-hunter && signal-hunter scan

# With logging
*/30 * * * * cd /path/to/signal-hunter && signal-hunter scan >> logs/cron.log 2>&1
```

---

## Supported Sources

| Source | Auth needed | Cost | Notes |
|--------|-------------|------|-------|
| Hacker News | None | Free | "Who is Hiring?" + comment search |
| Reddit | None | Free | Public API, 5 req/min limit |
| Remote OK | None | Free | Open JSON API |
| Twitter / X | Bearer token | Free tier | 500k tweets/month free |
| Custom URLs | None | Free | Any webpage via Jina.ai reader |

---

## Supported LLMs

| Provider | Model | Cost | Notes |
|----------|-------|------|-------|
| Google Gemini | gemini-2.0-flash | Free tier | Recommended for getting started |
| OpenAI | gpt-4o-mini | ~$0.01/1k signals | Fast and accurate |
| Anthropic Claude | claude-haiku | ~$0.01/1k signals | Strong reasoning |
| Ollama | llama3.2 | Free | Runs locally, 100% private |

---

## Commands

```bash
signal-hunter setup              # Run the setup wizard
signal-hunter doctor             # Check config and API keys
signal-hunter scan               # Scan all enabled sources
signal-hunter scan --source hn   # Scan a single source
signal-hunter scan --dry-run     # Preview without saving
signal-hunter list               # View your signal pipeline
signal-hunter list --min-score 80  # Filter by score
```

---

## Project structure

```
signal-hunter/
├── setup.mjs              ← Setup wizard
├── doctor.mjs             ← Health check
├── scan.mjs               ← Main scanner
├── list.mjs               ← Pipeline viewer
├── bin/cli.js             ← CLI entry point
├── config/
│   ├── profile.yml        ← Your config (gitignored)
│   ├── businesses.yml     ← Partner businesses (gitignored)
│   ├── sources.yml        ← Source config (gitignored)
│   └── *.example.yml      ← Templates (committed)
├── agents/
│   ├── qualifier.js       ← AI scoring engine
│   └── router.js          ← Multi-business routing
├── sources/
│   ├── hackernews.js
│   ├── reddit.js
│   ├── remoteok.js
│   └── custom.js          ← Jina.ai any-URL reader
├── integrations/
│   ├── discord-webhook.js
│   └── email.js
├── data/
│   └── signals.md         ← Your pipeline (gitignored)
└── utils/
    └── logger.js
```

---

## License

MIT — fork it, extend it, make it yours.

---

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

If Signal Hunter helped you land a client, drop a ⭐ — it helps others find the project.
