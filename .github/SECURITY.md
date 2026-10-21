# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅        |

VIZOR is a static site with no backend, no database and no accounts, so the
attack surface is small: the app itself, and the third-party players it
embeds.

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's private reporting form:

**Security → Report a vulnerability** on the repository page.

Include the affected version, a description, and reproduction steps if you have
them. You can expect an acknowledgement within 72 hours and a fix or a
mitigation plan within 14 days.

## Scope

In scope:

- Anything that lets a visitor run code in the VIZOR origin.
- Stored or reflected XSS through the channel dataset, the taxonomy file, or
  any query string the app reads.
- Path traversal or injection in the build scripts under `scripts/`.
- A compromised or tampered dependency that ships malicious code.

Out of scope:

- Third-party players and their own scripts. VIZOR embeds them in a
  sandboxed `<iframe>`; we do not control their code, their cookies or their
  ad behaviour.
- Denial of service against the source site or the embed hosts.
- Missing security headers on a personal deployment.

## Hardening already in place

- No analytics, no trackers, no third-party scripts of our own.
- No `dangerouslySetInnerHTML` anywhere in the app.
- Favourites are read from `localStorage` and validated as a string array
  before use.
- The dataset is a static module — no runtime fetch, no injection surface.
- CI runs a secret scan on every push and pull request.
