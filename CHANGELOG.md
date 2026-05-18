# Changelog

All notable changes to Signal Hunter are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [0.1.0] — 2026-05-19

### First public release

#### Added
- Interactive setup wizard (`signal-hunter setup`) — 2-minute onboarding
- Health check command (`signal-hunter doctor`)
- Multi-source scanner: Hacker News, Reddit RSS, Remote OK, Twitter/X, custom URLs
- AI qualification engine with multi-LLM support: Gemini, OpenAI, Claude, Ollama
- 429 retry with backoff for Gemini rate limits
- Pre-filter stage — zero AI cost for obvious mismatches
- Interleaved source sampling — each source gets a fair share of the AI cap
- Pipeline viewer (`signal-hunter list`) with score/status/source filters
- Signal management: `reply`, `skip`, `open`
- Built-in cron daemon: `cron start/stop/status/logs/install`
- Multi-business routing via `config/businesses.yml`
- Discord webhook notifications (no bot setup — paste a URL)
- MCP server (`signal-hunter-mcp`) — works in Claude Code, Cursor, VS Code
- `--dry-run` and `--min-score` scan flags
- `--source` flag for single-source scans

#### Sources
- **Reddit**: Public RSS via `old.reddit.com` — no OAuth, no credentials
- **Hacker News**: Firebase job stories + Algolia full-text search
- **Remote OK**: Open JSON API, no auth
- **Twitter/X**: Bearer token, 500k tweets/month free tier
- **Custom URLs**: Any webpage via Jina.ai reader (free)

#### LLMs supported
- Google Gemini (`gemini-flash-latest`, free tier)
- OpenAI GPT-4o-mini
- Anthropic Claude Haiku
- Ollama (local, free, private)

---

[0.1.0]: https://github.com/loondx/signal-hunter/releases/tag/v0.1.0
