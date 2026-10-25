# Security Policy — Obsidian Exchange

## Supported scope

We provide security fixes for the current `main` branch:

- `v1/Obsidian-Core` (Laravel 8 backend)
- `v1/Obsidian-Client` (Next.js 12 frontend)
- `v1/Obsidian-Vault` (Express chain gateway)

Self-hosted deployments should track `main` and apply updates promptly.
Fresh installs seed demo/launchpad/futures data — never use seed credentials in production.

## Reporting a vulnerability (responsible disclosure)

**Do NOT file a public GitHub issue for a suspected vulnerability.**
Public disclosure puts all self-hosted operators at risk.

1. Contact the maintainers privately: `SECURITY-CONTACT-PLACEHOLDER` (replace with a real security contact email before going public).
2. Include: affected component + version/commit, impact, and minimal reproduction steps (redacted).
3. Allow reasonable time for a fix before any public disclosure.
4. We will acknowledge receipt, coordinate a fix, and credit reporters who wish to be credited.

## Secret handling

- Never paste `.env` contents, JWTs, API secrets, or private keys in issues, PRs, discussions, or logs.
- Redact tokens and credentials from all reports and screenshots.
- If you accidentally commit a secret, rotate it immediately and notify maintainers.

## Out of scope

- Social engineering, physical attacks, or third-party hosted infrastructure outside this repo.
- Vulnerabilities in end-of-life dependencies reported without a reproduction against `main`.
