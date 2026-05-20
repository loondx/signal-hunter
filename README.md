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

Watches Reddit, Hacker News, Remotive, Remote OK, Dev.to, GitHub Issues, Upwork, and Freelancer.com for the moment someone describes a problem you can solve. AI scores each post 0–100, filters noise, pings Discord on real leads, and generates a ready-to-send message.

```
  [95] 🔥  Upwork                  "Need n8n expert — Stripe→Notion→Slack pipeline.
                                    Budget $800–1200. Start ASAP."   💰 $800–1,200

  [88] 📌  Reddit r/SaaS            "Team spends 3h/day copying data between Airtable
                                    and HubSpot. Need a contractor. $500–800 budget."

  [81] 📌  Hacker News              "React + Node contractor — AI dashboard, 3-month
                                    engagement, $8k/month, remote."  💰 $8,000/mo
```

---

## Install

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/loondx/signal-hunter/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/loondx/signal-hunter/main/install.ps1 | iex
```

**npm**
```bash
npm install -g signal-hunter
```

> Requires Node.js 20+. Shell installers auto-install Node.js if missing.

---

## Quick Start

```bash
signal-hunter setup      # 3-minute wizard — sources, API keys, Discord, scan interval
signal-hunter doctor     # verify everything is connected
signal-hunter scan       # find your first leads
signal-hunter list       # view your pipeline
signal-hunter reply 1    # AI outreach package — copy-paste ready
signal-hunter cron start # run automatically in the background
```

---

## Commands

```bash
# Setup
signal-hunter setup                        # interactive onboarding wizard
signal-hunter doctor                       # check config, API keys, connectivity
signal-hunter doctor --test-discord        # send a test Discord ping
signal-hunter auth upwork                  # connect Upwork (browser OAuth2)
signal-hunter auth freelancer              # connect Freelancer.com (guided token)

# Scanning
signal-hunter scan                         # scan all enabled sources
signal-hunter scan --source remotive       # scan one source only
signal-hunter scan --dry-run               # qualify without saving
signal-hunter scan --min-score 50          # override score threshold

# Pipeline
signal-hunter list                         # view all signals, sorted by score
signal-hunter list --min-score 75          # filter by score
signal-hunter list --status new            # new | replied | skipped
signal-hunter list --source github         # filter by source name
signal-hunter insights                     # source stats + learning data

# Acting on leads
signal-hunter reply <num>                  # full outreach: message, follow-up, proposal
signal-hunter skip  <num>                  # hide + update self-learning
signal-hunter open  <num>                  # open original URL in browser

# Automation
signal-hunter cron start                   # start background daemon
signal-hunter cron start --interval 30m   # 15m | 30m | 1h | 2h | 6h | 12h | 24h
signal-hunter cron stop
signal-hunter cron status
signal-hunter cron logs
signal-hunter cron install                 # print crontab/Task Scheduler/launchd config

# Maintenance
signal-hunter update                       # git pull + npm install
signal-hunter version
```

---

## Sources

### Free (no credentials)

| Source | Notes |
|--------|-------|
| **Reddit** | 30+ subreddits — r/forhire, r/freelance, r/startups, r/n8n, r/AI_Agents… |
| **Hacker News** | "Who is Hiring?" thread + Algolia keyword search |
| **Remotive** | Contract and freelance tech roles only — full-time pre-filtered |
| **Remote OK** | Contract/freelance remote jobs — full-time posts removed |
| **Dev.to** | `#hiring`, `#automation`, `#react`, `#ai` tags |
| **GitHub Issues** | Hiring signals in public repos (`enabled: false` by default — flip to `true`) |
| **RSS / JSON API / Webpage** | Add any source in `sources.yml` — no code needed |

### Premium (credentials required)

| Source | Setup |
|--------|-------|
| **Upwork** | `signal-hunter auth upwork` |
| **Freelancer.com** | `signal-hunter auth freelancer` |
| **Web Search** | `SERPER_API_KEY` in `.env` — free 2,500 queries at serper.dev |

---

## Configuration

**`config/profile.yml`** — edit this first. Write client pain, not your CV:

```yaml
services:
  what_you_do: >-
    Full-stack AI engineer: React, Node.js, n8n automation, Discord bots,
    AI agents, SaaS MVP development, REST APIs.

  buying_signals: >-
    Broken Zapier flows, manual copy-paste between tools, need a Discord bot,
    AI agent, or MVP built fast. Founder or small team. Mentions budget.

  red_flags: [equity only, gambling, adult content, crypto token]
  budget_min: "$300"

llm:
  provider: gemini          # gemini (free) | claude | openai | ollama
  model: gemini-flash-latest
  min_score: 55

notifications:
  discord_webhook: "https://discord.com/api/webhooks/..."
  notify_min_score: 65
```

**`config/sources.yml`** — toggle sources on/off and tune `posts_per_scan`.

---

## License

MIT — see [LICENSE](LICENSE).

<div align="center">

Built by freelancers, for freelancers. If Signal Hunter got you a client, drop a ⭐

**[Issues](https://github.com/loondx/signal-hunter/issues) · [npm](https://www.npmjs.com/package/signal-hunter)**

</div>
