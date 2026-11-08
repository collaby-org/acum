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
| The app never lands on `/conturi` | #10 (item 1), #17 (item 7) | `proxy.ts`, `lib/admin.ts`, `lib/supabase/server.ts`, the four catalogue pages (both apps), both manifests, both service workers | the catalogue pages do not gate on the session; the session read tells *signed out* apart from *could not be checked* and is bounded; `verify-front-door.mjs` prints the route chain in three device states and fails if `/conturi` appears in it |
| The volume dot is small and on the track | #17 (item 9) | both apps' `player-controls.tsx` + `globals.css` | the native knob is gone (`-webkit-appearance: none` on the input element, which is what iOS reads) and the app draws a 12px dot, inset by its radius; the input stays 44px tall |
| The bar's controls do not overlap on hover | #17 (item 9) | both apps' `player-controls.tsx`, `video-player.tsx` | the duplicated **"Scrie o recenzie"** button left the bar — the channel panel beside the picture keeps the action — and the right-hand controls are one group |
| The header clears the iPhone notch | #17 (item 8) | `components/header.tsx` | the row starts below `env(safe-area-inset-top)`, with `viewport-fit=cover` |
| A phone keeps the live edge | #17 (item 6) | both apps' `video-player.tsx` + `use-player.ts`, `app/api/stream/route.ts` | an interrupted `play()` is not a failure; the watchdog counts the seconds in which the picture does not move; the chain is asked for again once before the session is called a failure; the proxy answers inside the live window |
| The proof harnesses tell the truth | #17 (item 15) | `scripts/verify-{mobile,mobile-stream,acum,player-bar}.mjs` | each script names the check that carries its verdict and prints the evidence it rests on |
| The phone's picture arrives and stays | #10, #17 (item 6) | both apps' `components/player/video-player.tsx` | the watchdog never reloads the media element and leaves the cold start alone; on a throttled phone line, against the same signed manifest, the playhead advanced **32.55 s** with **219 painted frames** and the proxy answered **4 playlists / 6 segments** — where the element as shipped never left `readyState 0`, painted nothing and pulled 19 / 13 |
| A review can only name a programme the guide knows | #16 | both apps' `lib/guide.ts`, `lib/reviews.ts` | the server resolves the slot it is given and answers with the guide's own title and instants; a partial or a forged slot has no answer |
| An account without a name is not published by its e-mail | #16 | both apps' `lib/reviews.ts` | the review is signed **„Vizitator ACUM"**, never the e-mail's local part |
| A failed edit is not a server error | #16 | both apps' `lib/reviews.ts` | **503** — „Modificarea recenziilor nu este disponibilă acum" |
| The television app answers the review API like the web app | #16 | `monorepo/tv/src/app/api/reviews/route.ts`, `hooks/use-reviews.ts`, `components/channel/channel-panel.tsx`, `lib/supabase/server.ts` | the `mine` branch first, the visitor's own client, a case-insensitive `mine`, a memoised hook, an error state with **„Încearcă din nou"** — and `lib/reviews.ts` is byte-for-byte the same file in both apps |
| One Back press closes one layer | #16, #17 | both apps' `components/player/player-modal.tsx`, `components/reviews/zoom-overlay.tsx` | the player and the sheet each push their own marker and answer only for the entry they pushed themselves |
| The harnesses measure the app, not a stale file | #16, #17 | `scripts/verify-{player-bar,acum,mobile-stream}.mjs` | the bar program reaches the browser with its escapes intact and throws on a protocol error instead of reporting a missing bar; the `acum` harness asks the running app (`/api/channel/<id>`); the phone-stream harness records the painted frames, the buffer and the playhead |

---

## B. In flight — this wave

| Item | Issue | Owner | Done when |
| ---- | ----- | ----- | --------- |
| The live proof of the new release | #10, #16, #17, #22 | orchestrator | the harnesses are run against the deployed **1.8.2** and the measured numbers are written into `docs/verification.md` |

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
  Web Animations API path itself.

Everything else that was open about the review engine landed in **1.8.2**:
one Back press closes one layer; the television app answers the review API
exactly like the web app; the server resolves the programme slot from the
guide and refuses a slot that is not in it; the author label never
publishes the e-mail's local part; and the harness's own cleanup knows the
row it created. Each of those is in section A, with the proof.

The harness's live run against the deployed **1.8.0** passed **18/18** — see
`docs/verification.md` §10; the run against **1.8.2** lands with the deploy.

---

## F. Blocked on a person — nothing any more

Every item was checked against the live deployment and the repository
itself, and each one is closed by what was measured, not by an assumption.

| Item | Was | Now | Evidence |
| ---- | --- | --- | --- |
| Add `gmgmethereum@gmail.com` to Vercel's `ADMIN_EMAILS` | the owner | **done** | `GET /api/account` with the owner's own token answers `200` and `isAdmin=true` — the desk is open to the owner |
| Set `KODUS_API_URL` and `KODUS_TEAM_KEY` | the owner | **done** | `gh secret list` shows both, added 2026-10-29. The review had been skipping its steps because Dependabot pull requests do not receive repository secrets; a manual dispatch on `main` runs them |
| Set `LLM_API_BASE` and `LLM_API_KEY` | the owner | **done** | both are set (2026-10-29); the PR-Agent workflow reads them |
| Install the Kodus CLI and the PR-Agent CLI | the owner | **not needed** | the Kodus CLI was never broken upstream — the workflow pinned Node 20, and the CLI's `undici 8` needs `zlib.createZstdDecompress` (Node ≥ 22.15). The workflow now pins Node 22.19 and the CLI authenticates. PR-Agent runs from the workflow, and `.pr_agent.toml` now carries the repository's own rules for it to judge the diff against |

---

## G. Later, not now

- A scheduled workflow that re-runs the scrapers, the probe, the resolver and
  the measurement and opens a pull request when the catalogue changes.
- The bandwidth cost of relaying every video byte, measured and decided.
- A generated poster for the channels that still have no logo.
