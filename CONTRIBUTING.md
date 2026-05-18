# Contributing to Signal Hunter

Thanks for taking the time to contribute! This document covers everything you need.

## Quick start for contributors

```bash
git clone https://github.com/yourusername/signal-hunter
cd signal-hunter
npm install
cp config/profile.example.yml config/profile.yml   # edit with your details
cp .env.example .env                                # add your LLM API key
node doctor.mjs                                     # verify setup
```

## Ways to contribute

### Good first issues

| Task | Skill needed | Notes |
|------|-------------|-------|
| Add a new source | Node.js | Copy `sources/remoteok.js` as a template |
| Add a new LLM provider | Node.js | Add a `callXxx()` function in `agents/qualifier.js` |
| Improve pre-filter accuracy | Logic | `agents/qualifier.js` — `preFilter()` |
| Email digest integration | Node.js + nodemailer | `integrations/email.js` |
| Better CLI output | picocolors | `list.mjs`, `scan.mjs` |

### Adding a new source

1. Create `sources/yoursource.js` — export `fetchYourSource(profile, sourcesConfig)`
2. Each result must have: `{ id, source, text, url, author, posted_at }`
3. `id` must be unique and stable (same post = same id across runs)
4. Register in `scan.mjs` → `SOURCE_FETCHERS` map
5. Add to `config/sources.example.yml`
6. Add to `config/profile.example.yml` under `sources.enabled`

### Adding a new LLM provider

1. Add a `callYourProvider(prompt, model)` function in `agents/qualifier.js`
2. Add it to the `switch` in `qualify()`
3. Add to the `LLM_MODELS` map in `setup.mjs`
4. Document in README LLMs table

## Pull Request process

1. Fork the repo and create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes
3. Test manually: `npm run doctor`, `npm run scan --dry-run`
4. Commit with a clear message: `feat: add LinkedIn source`
5. Open a PR against `main`

## Code style

- ES Modules (`import/export`) — no CommonJS
- No TypeScript — plain `.mjs` / `.js`
- No `console.log` in library code — use `logger.info/warn/error` from `utils/logger.js`
- Prefer `picocolors` over `chalk` for terminal colour
- Keep dependencies minimal — check if Node built-ins can do the job first

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).

Include:
- Your OS and Node.js version (`node --version`)
- Which source/command failed
- The full error output (run with `DEBUG=1` if relevant)
- Your `config/profile.yml` (remove API keys)

## Security issues

Do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree your changes are licensed under the [MIT License](LICENSE).
