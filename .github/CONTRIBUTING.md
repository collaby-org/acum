# Contributing to ACUM

Short guide for contributors. ACUM is a Next.js (App Router, TypeScript) application for watching Romanian TV.

## Workflow

1. Branch from `main` (one branch per change, e.g. `feat/...`, `fix/...`).
2. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, ...).
3. Before pushing, run:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
4. Update `docs/changelog.md` for user-visible changes.
5. Fill in the PR template fully and link the issue; attach screenshots for UI changes.
6. Keep PRs small and scoped to one change where possible.

## Secrets

- Never commit `.env` files, API keys, tokens, or other secrets.
- Redact credentials from logs, screenshots, and issue reports.

## Reviews

- Advisory review bots (Kodus, PR-Agent) inform the discussion, but the local
  review gate decides: it must be clean before the pull request is opened.
- Do not merge without approval.
