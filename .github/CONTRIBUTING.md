# Contributing — Obsidian Exchange

Short guide for contributors. Private self-hosted crypto exchange: Laravel 8 backend (`v1/Obsidian-Core`), Next.js 12 frontend (`v1/Obsidian-Client`), Express chain gateway (`v1/Obsidian-Vault`).

## Workflow

1. Branch from `main` (one branch per change, e.g. `feat/...`, `fix/...`).
2. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, ...).
3. Run the relevant checks before pushing:
   - Core: `php -l` on changed files, `php artisan route:list` for route changes.
   - Client: `yarn lint` (and `yarn build` for significant UI changes).
4. Update `docs/changelog.md` (and related docs) for user-visible changes.
5. Fill in the PR template fully, link the issue, attach screenshots for UI changes.
6. Keep PRs small and scoped to one component where possible.

## Secrets

- Never commit `.env` files, JWTs, API secrets, or private keys. Env files are never committed.
- Redact credentials from logs, screenshots, and issue reports.

## Reviews

- Kodus review must be clean before merge.
- PR-Agent review comments must be resolved to zero.
- Do not merge unless approved per repo policy.
