# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: pankajkumar.techie@gmail.com  
Subject line: `[signal-hunter] Security vulnerability`

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive a response within 48 hours. Serious vulnerabilities will be patched and disclosed responsibly.

## Scope

In scope:
- Command injection via config values
- Arbitrary file read/write via config paths
- Sensitive data leaking to third parties (beyond the configured LLM provider)

Out of scope:
- Rate limiting of external APIs (Reddit, HN, etc.)
- Denial-of-service via crafted config files (self-hosted tool)

## API Keys

Signal Hunter stores API keys in a local `.env` file. This file is:
- Listed in `.gitignore` — never committed
- Listed in `.npmignore` — never published
- Read only at runtime — never transmitted to any service except your chosen LLM provider
