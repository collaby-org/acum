# Backlog

The open work, in the order it earns its place. Every item names the GitHub
issue it belongs to, so nothing is tracked twice.

Status vocabulary: **Done** (landed and measured) · **In flight** (this wave)
· **Open** (not started) · **Blocked** (waiting on a person, not on us).

---

## A. Closed in this wave

| Item | Issue | Where it landed | Proof |
| ---- | ----- | --------------- | ----- |
| A signed-in visitor never bounces | — | `proxy.ts`, `lib/session-token.ts` | `307 → /canale` |
| The pricing cards tell the truth | — | `components/account/plans-grid.tsx` | live render |
| The catalogue answers in a fraction of a second | — | `lib/channel-detail.ts` | 3359 ms → 341 ms |
| One control bar, inside the frame | — | `components/player/*` | `verify-player` PASS |
| The iPhone safe area is respected | — | `viewport-fit=cover`, `env(safe-area-inset-*)` | live render |
| The stream starts on a phone | — | `video-player.tsx` (mute fallback) | `readyState 4` |
| The stream proxy takes a token only | — | `app/api/stream/route.ts`, `lib/stream.ts` | `?u=` → 400, forged → 403 |
| The browser can no longer name an upstream address | — | `app/api/player/route.ts`, `app/api/resolve/route.ts` | 403 without a session |
| The upstream allowlist is exact, redirects re-checked | — | `lib/stream.ts` | live probe |
| The desk is an allowlist, not a flag | — | `app/api/account/route.ts`, live database | query on the live project |
| The account RPCs are service-role only | — | `supabase/migrations/20261103_security_policies.sql` | query on the live project |
| The programme guide is current | — | `data/epg.json` (`npm run data:epg`) | 77/83 channels, 1226 programmes |

---

## B. In flight — this wave

| Item | Issue | Owner | Done when |
| ---- | ----- | ----- | --------- |
| The player bar is one line, one size, 44px targets, a centred buffering animation, the connection chip and the quality in one cluster | — | designer | the bar does not wrap at 320px and every target is ≥44px |
| `/api/player` answers in the catalogue's order, with a probe budget of about 1.2 s | — | fixer | the picture arrives inside the harness readiness window on a throttled phone |
| The bottom bar is on the plans page, and "home" never takes a redirect | — | fixer | `verify-mobile-nav.mjs` PASS on `/preturi` |
| The channel panel leads with the programme, and says so honestly when there is none | #17 (item 8) | designer | the panel order is programme → channel text → "Urmează" |

---

## C. Open — #17, production readiness

[Issue #17](https://github.com/collaby-org/acum/issues/17) is the checklist
that decides whether the app feels finished on a real phone.

| # | Item | Why it matters |
| - | ---- | -------------- |
| 3 | Offer the install only on a desktop, where the prompt means something | a phone that already is the app should not be offered itself |
| 4 | The channel page leads with the programme | **in flight** |
| 7 | Navigation and back behaviour everywhere | **in flight** for the bottom bar; the rest is audited with it |
| 8 | `min-h-dvh` on every full-height surface | the iPhone URL bar changes the viewport height mid-scroll |
| 9 | Inputs at 16px and up | iOS zooms the page when a field is smaller |
| 10 | Hover effects only under `@media (hover: hover)` | a sticky hover state on a phone is a stuck state |
| 11 | `touch-action: manipulation` | removes the 300 ms tap delay and the double-tap zoom |
| 12 | `text-size-adjust: 100%` | stops iOS inflating the text in landscape |
| 13 | Every touch target at least 44×44 px | **in flight** for the player bar |
| 14 | One vocabulary of radius, border, shadow and type | the app still has more than one way to look |
| 15 | Three real states for every async surface | loading, empty and failed, every time |

---

## D. Open — #10, the catalogue and the pipeline

[Issue #10](https://github.com/collaby-org/acum/issues/10).

| # | Item | Note |
| - | ---- | ---- |
| 4 | Dynamic channel thumbnails | the catalogue holds logos; a still would carry the brand better on a dead feed |
| 5 | A badge vocabulary (Netflix, ITVX) | one badge means one thing, everywhere |
| 6 | Workflow secrets and the Kodus review | the local Kodus CLI shim is broken (`Cannot find module …\@kodus\cli\dist\index.js`); the PR-Agent CLI is not installed here either |

---

## E. Open — #16, the social layer

[Issue #16](https://github.com/collaby-org/acum/issues/16). Untouched by this
wave — deliberately, so the production fixes were not queued behind a feature.

Reviews, star ratings, reactions with server-truth counters, popular reviews,
composer motion, and mobile/PWA parity.

---

## F. Blocked on a person

| Item | Who | Why |
| ---- | --- | ---- |
| Add `gmgmethereum@gmail.com` to Vercel's `ADMIN_EMAILS` (comma-separated) | the owner | the desk is an allowlist; without the address in the environment the owner cannot open it |
| Install the Kodus CLI and the PR-Agent CLI | the owner | the shims in this environment cannot resolve their entry points |
| Dependabot PR #19 | the owner | left open after #18 was closed — TypeScript 7 breaks `typescript-eslint` |

---

## G. Later, not now

- A scheduled workflow that re-runs the scrapers, the probe, the resolver and
  the measurement and opens a pull request when the catalogue changes.
- The bandwidth cost of relaying every video byte, measured and decided.
- A generated poster for the channels that still have no logo.
