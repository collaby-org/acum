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
| The guide refreshes itself twice a day | #17 (item 5) | `.github/workflows/epg-refresh.yml` | the cron runs; every run reports the guide's state |
| The review tables are locked twice | #16 | `supabase/migrations/20261104_review_grants.sql` | live database: an anonymous visitor may only **read**; the table privileges were read back from `information_schema.role_table_grants` |
| A review can be changed by its author | #16 | the same migration | the author-scoped UPDATE policy, read back from `pg_policies`; another account's update moves 0 rows |
| The three schema copies are one file | #17 (item 12) | `supabase/`, `monorepo/frontend/supabase/`, `monorepo/tv/supabase/` | identical SHA-256; the whole set applies twice on `postgres:16` with `ON_ERROR_STOP=1` |
| The protected branch can be satisfied | #17 (item 12) | `.github/workflows/ci.yml` | the gate **"Lint, type-check and build"** is green only when both apps really passed |
| The secret scan reads the repository, not the documentation | — | `.gitleaks.toml`, `.gitleaksignore` | gitleaks 8.30.1: no leaks in the working tree, no leaks in 97 commits |
| The broken review bots stop painting red | #10 (item 6) | `.github/workflows/kodus-review.yml` | the Kodus step warns instead of failing the check |
| The install offer belongs to the phone | #17 (item 3) | `components/pwa/install-prompt.tsx` | the card returns `null` off the phone; to be re-checked in the browser |
| The viewport follows the browser chrome | #17 (item 8) | every full-height shell | `min-h-dvh` (or `min-h-[100dvh]`) everywhere; no `min-h-screen` left |
| The phone never zooms the page by itself | #17 (item 8) | `app/globals.css` | inputs are ≥16px; `text-size-adjust: 100%`; `touch-action: manipulation`; hover rules under `@media (hover: hover)` |
| The television app follows the same phone rules | #17 (item 8) | `monorepo/tv/src/app/globals.css` | the same five rules, in the television app: the dynamic viewport, the text size, the tap, the overscroll, the hover |
| The player bar is one line, one size, 44px targets, a centred buffering animation, the connection chip and the quality in one cluster | #17 (item 9) | both apps' `components/player/player-controls.tsx` | one exported control size and one icon size for the whole bar; the sliders have a thumb you can catch; the volume prints its value |
| The bottom bar answers a tap without a redirect | #17 (item 7) | `components/mobile-nav.tsx`, `app/canale/loading.tsx` | prefetch on intent + a `/canale` loading boundary; `verify-mobile-nav.mjs` re-measured after the deploy |
| The channel panel leads with the programme | #17 (item 4) | `components/channel/channel-panel.tsx` | the panel order is programme → channel text → "Urmează" |
| The review engine mirrors into the television app | #16 | `monorepo/tv/src/**` | the same engine, the same vocabulary, the same honesty rules, and the same visitor-token writes |
| The channel surface manages the visitor's own review | #16 | `components/channel/channel-panel.tsx` (both apps) | the visitor's own review of the programme on air is read under their own token, and they can edit and delete it there |
| The composer stops asking what it already knows | #16 | `components/reviews/review-composer.tsx` (both apps) | one channel → the channel is shown, not chosen; many → the select stays |
| Back closes the composer, and the page comes back where it was | #17 (item 7) | `components/reviews/zoom-overlay.tsx` (both apps) | the sheet pushes a history entry, a Back press closes it, and the scroll behind it is restored |
| The review engine gets its own harness | #16 | `scripts/verify-reviews.mjs` | the harness proves the write, the own read, the public read, the three counters, the reaction move, the edit, the delete and the refused anonymous write — and cleans up after itself |

---

## B. In flight — this wave

| Item | Issue | Owner | Done when |
| ---- | ----- | ----- | --------- |
| The live proof of the new release | #16, #17 | orchestrator | the harnesses are run against the deployed 1.8.0 and the measured numbers are written into `docs/verification.md` |

---

## C. Open — #17, production readiness

[Issue #17](https://github.com/collaby-org/acum/issues/17) is the checklist
that decides whether the app feels finished on a real phone.

| # | Item | Why it matters |
| - | ---- | -------------- |
| 1 | The landing page paints the visitor's region once | the server and the client must not disagree about the price |
| 6 | The cold start reads as "connecting", not as a dead frame | the first frame has to arrive in seconds |
| 7 | Back and forward restore the scroll position | the player, the channel page, the composer and the sheet each return where they were |
| 11 | One vocabulary of radius, border, shadow and type | the app still has more than one way to look |
| 12 | Every async surface has loading, empty and error-with-retry | a failed read must never be painted as an empty catalogue |
| 15 | No console errors on any route, at any width | the console is part of the product |

---

## D. Open — #10, the catalogue and the pipeline

[Issue #10](https://github.com/collaby-org/acum/issues/10).

| # | Item | Note |
| - | ---- | ---- |
| 4 | Dynamic channel thumbnails | the catalogue holds logos; a still would carry the brand better on a dead feed |
| 5 | A badge vocabulary (Netflix, ITVX) | one badge means one thing, everywhere — the rule is defined; the per-show quality data is not there yet, so the badges stay honest by being absent |
| 6 | The owner's credentials for the review bots | `KODUS_API_URL`, `KODUS_TEAM_KEY`, `LLM_API_BASE`, `LLM_API_KEY` are not in the repository's environment; the workflows now skip or warn instead of failing, and the review has not run once with real credentials |

---

## E. Open — #16, the social layer

[Issue #16](https://github.com/collaby-org/acum/issues/16). The engine is in
place in both apps — a review is a star rating and a written comment on the
programme airing now, the visitor sees their own review on the channel
surface and can change and delete it there, the counters are server truth,
and the popular reviews sit below the hero on the homepage of the web app
and of the television app. What is still open:

- the motion pass: the composer pops from the point it was opened from and
  closes toward the pointer, with the reduced-motion media query read by the
  Web Animations API path itself;
- the harness's live run against the deployed 1.8.0 — the script is written
  and has been run against the deployed 1.7.10 (16 of the 18 checks passed;
  the two that failed are the `mine` flag, which the deployed build does not
  carry yet).

---

## F. Blocked on a person

| Item | Who | Why |
| ---- | --- | --- |
| Add `gmgmethereum@gmail.com` to Vercel's `ADMIN_EMAILS` (comma-separated) | the owner | the desk is an allowlist; without the address in the environment the owner cannot open it |
| Set `KODUS_API_URL` and `KODUS_TEAM_KEY` | the owner | the Kodus review cannot run without them; the published CLI is broken upstream as well |
| Set `LLM_API_BASE` and `LLM_API_KEY` | the owner | the opencode review calls a model the configured gateway does not serve (`AI_APICallError: Not Found`) |
| Install the Kodus CLI and the PR-Agent CLI | the owner | the shims in this environment cannot resolve their entry points |

---

## G. Later, not now

- A scheduled workflow that re-runs the scrapers, the probe, the resolver and
  the measurement and opens a pull request when the catalogue changes.
- The bandwidth cost of relaying every video byte, measured and decided.
- A generated poster for the channels that still have no logo.
