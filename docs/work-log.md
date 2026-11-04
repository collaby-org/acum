# Work log — the 1.7.x delivery wave

A living record of this wave: what was asked, what was done, how it was
measured, and which commit carries it. Every "fixed" line has a command
output or a live probe behind it; nothing here is closed on a claim.

The same log lives in GitHub issue
[#22](https://github.com/collaby-org/acum/issues/22) — the issue is updated
after every push.

Wave start: 2026-11-04 · Target: `main` · Live site:
<https://acum-weld.vercel.app/>

---

## 1. The brief

Two reports from the owner, in their own words.

**Report A — six production bugs.**

| # | Bug as reported |
| - | --------------- |
| 1 | A signed-in visitor lands on the landing page first and gets bounced — the auth redirect loop |
| 2 | The pricing cards ignore the plan the visitor is already on |
| 3 | The catalogue is sluggish — every request walks the whole guide |
| 4 | The player's controls are a second bar under the video instead of one bar in the frame |
| 5 | The iPhone safe area is ignored in the installed app |
| 6 | The stream never starts on a phone or in the PWA |

**Report B — three phone regressions, after the first fixes were live.**

| # | Bug as reported |
| - | --------------- |
| 7 | The player bar is too heavy: oversized buttons, a loading strip, a huge quality button, a weak live badge — "we must have always only 1 line" |
| 8 | On mobile and in the PWA the stream plays a few seconds, rolls back five seconds, and replays the same sequence; the desktop is fine |
| 9 | The bottom bar does not act: several taps, seconds of delay, and on the plans page there is no bar at all |

The brief also asked for a changelog, documentation, README, graphics,
diagrams, a backlog, a GitHub issue that is kept up to date, and continuous
pushes to `main`.

---

## 2. How the work was split

Six lanes, one owner each, no two writers on the same file. The ledger is
`.agents/lanes.json`.

| Lane | Owner | Files | Status |
| ---- | ----- | ----- | ------ |
| auth | fixer | `proxy.ts`, `lib/session-token.ts`, store cleanup | **landed** |
| security / stream | fixer | `app/api/stream/route.ts`, `lib/stream.ts`, `app/api/resolve/route.ts` | **landed** |
| security / admin + DB | fixer + orchestrator | `app/api/account/route.ts`, `supabase/migrations/20261103_security_policies.sql` | **landed** |
| performance | fixer | `lib/channel-detail.ts`, `app/api/channel/[id]/route.ts` | **landed** |
| player UI (first pass) | fixer | `components/player/*` | **landed** |
| player bar (owner report) | designer | `components/player/player-controls.tsx`, `player-quality.tsx`, `video-player.tsx` | **in correction** — the first pass wrapped onto a second row |
| phone latency | fixer | `app/api/player/route.ts` (both apps), `components/mobile-nav.tsx`, `app/preturi/page.tsx`, `lib/session-token.ts` | **in flight** |
| channel panel | designer | `components/channel/channel-panel.tsx`, `canal-screen.tsx`, `app/canal/[id]/page.tsx` | **in flight** |
| verification + docs | orchestrator | `scripts/verify-*.mjs`, `docs/`, `README.md`, `data/epg.json` | **in flight** |

---

## 3. The prompts, and what came back

Every lane was briefed the same way: the observed bug, the measured numbers,
the files it may touch, the contract it must satisfy, and the commands it must
run and report.

| Prompt (one line) | Result |
| ----------------- | ------ |
| "The proxy must read the session, not its presence; the browser renews, the server never touches the refresh token" | `proxy.ts` (the Next 16 rename of `middleware.ts`), `lib/session-token.ts`; the signed-in visit to `/` answers **307 → /canale** before any markup |
| "The pricing card must tell the truth about the plan in use" | current plan "Planul tău", cheaper plan disabled with "Ești deja pe un plan superior", richer plan "Treci la \<Plan\>" |
| "Read one channel's guide, not every slug" | `readChannelProgrammesById` + a per-channel fallback chain: **3359 ms → 341 ms** |
| "Token only, exact host allowlist, redirects re-checked per hop, no-store, no browser-named address" | `/api/stream` takes `?t=` only; `/api/resolve` and `/api/player` are gated; the key comes from the environment or is derived |
| "The desk is an allowlist, not a flag" | `ADMIN_EMAILS` or the `comp` plan; `profiles.bypass` lifts the paywall and nothing else; the trigger protects the desk's columns |
| "One bar inside the frame, every action reachable, 44px, Romanian, a tap never toggles playback" | the first pass of the bar, landed in `2ec2e68` |
| "One line only, one size, no loading strip, centre buffering animation, connection + quality in one chip" | the first pass wrapped onto a second row below 560px and two chips fell under 44px → **sent back for correction** |
| "The manifest answers as fast as the catalogue knows, not as slowly as the slowest probe" | in flight |
| "The bottom bar is on the plans page and its home action never takes a redirect" | in flight |
| "The panel leads with the programme and keeps the channel text as context" | in flight |
| "Ask the deployed site the questions the bugs were about" | `scripts/verify-live.mjs` — **11/11 checks pass** against the live site |

---

## 4. What the measurements actually said

The owner's reports are not self-evident, so each one was measured before it
was fixed. The numbers are in [verification.md](verification.md); the short
version:

| Report | Measured | Now |
| ------ | -------- | ---- |
| 1 — auth loop | a signed-in visit to `/` returned the landing page, then bounced | **307 → /canale** before any markup |
| 3 — slow catalogue | `/api/channel/pro-tv` took **3359 ms** | **341 ms** |
| 6 — mobile stream | the picture never arrived within **30 s** on a throttled Android phone | the cold start is being bounded by the catalogue's own order |
| 8 — mobile rollback | during a 30 s watch on a slow line: **0 backwards jumps**, the playhead advanced 36 s | the rollback did not reproduce; the dominant mobile fault is the cold start, not the playhead |
| 9 — bottom bar | on `/preturi` at 390×844 the harness found **no bottom navigation at all** (`{"nav": false}`) | the bar is being added to that page, and "home" is being decided locally |

Two of the owner's symptoms had a different cause than they looked like, and
saying so early was the point of measuring rather than guessing.

---

## 5. The living delivery log

Each push adds a line here.

| Version | Commit | What it carries |
| ------- | ------ | --------------- |
| 1.7.0 | `2ec2e68` | the six production bugs and the security wave, live and verified |
| 1.7.1 | `decff00` | the programme-guide refresh, the verification harnesses, the diagrams and this documentation set |
| 1.7.2 | `eec0d83` | the player bar: one line, one size, the buffering in the middle of the picture, the connection chip |
| 1.7.3 | see `git log` | the player-bar harness, measured against the live site |
