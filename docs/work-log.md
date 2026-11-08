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
| phone latency | fixer | `app/api/player/route.ts` (both apps), `components/mobile-nav.tsx`, `app/preturi/page.tsx`, `lib/session-token.ts` | **landed** (1.7.4) — probe budget 1.2 s, the bar on the plans page, "home" decided locally |
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
| 1.7.3 | `9756757` | the player-bar harness, measured against the live site |
| 1.7.4 | `5f3b22c` | the cold start (a 1.2 s probe budget), the bottom bar on the plans page, an instant "home" |
| 1.7.5 | `f262825` | the channel panel leads with the programme; the channel's own text moves under "Despre canal" |
| 1.7.6 | `8a62994` | the manifest's phases are visible (`Server-Timing`), and the resolution phase has a 2.5 s ceiling |
| 1.7.7 | see `git log` | the fallback programme guide refreshes twice a day and every run reports the guide's state |
| 1.7.8 | see `git log` | the review tables' privileges and the author-scoped update; three identical schema copies; the CI gate the protected branch names |
| 1.7.9 | see `git log` | the secret scan reports the name the protected branch asks for, and it reads the repository instead of the documentation |
| 1.7.10 | see `git log` | the broken Kodus CLI stops painting a red check on every pull request; Dependabot stops offering the opencode action that upstream removed |
| 1.8.0 | see `git log` | the review engine in the television app, the channel surface managing the visitor's own review, Back closing the composer, the phone rules the television app was missing, and the harness that proves the review engine end to end |
| 1.8.1 | see `git log` | the front door never lands on `/conturi` (web, phone, installed PWA); the volume dot is small and on the track; the bar's controls do not overlap; the header clears the iPhone notch; a phone keeps the live edge; the harnesses name the check that carries their verdict |
| 1.8.2 | see `git log` | the phone's picture arrives and stays — the watchdog never resets the media element and leaves the cold start alone; the review engine stops guessing — the guide owns the slot, the account owns the name, a failed edit is a 503; the harnesses ask the running app instead of a stale file |

---

## 7. The 1.8.2 wave - the phone's picture and the review engine's honesty

Two faults, found by measurement rather than by reading.

**The phone.** The owner's report - the connection loops and drops on mobile
and in the installed PWA - was measured as a controlled experiment: one
browser per run, one `<video>` per browser, the same signed manifest, the
same throttled phone line. The watchdog that 1.8.1 added to mend a frozen
stream was resetting the media element every five seconds on the browsers
that play HLS natively (Safari, and Chromium, whose
`canPlayType("application/vnd.apple.mpegurl")` answers *"maybe"*). A reset
throws away every byte already fetched, cancels the segment that was on its
way and rejects the pending `play()` with an `AbortError` - so on a slow
line the frame was cancelled again and again, and the viewer waited for a
picture that never came. The watchdog keeps its promise (a picture that
stops is mended, a dead link moves the chain on) and drops the destructive
part. Measured: the playhead advanced **32.55 s** with **219 painted
frames**, against **0 s** and **0 frames** for the element as shipped.

**The review engine.** Ten findings, closed in both apps: the guide owns
the programme slot; the account owns the name; a failed edit is a 503 and
not a server error; the television app answers the review API exactly like
the web app; one Back press closes one layer; the channel panel has an
error state with a retry; and the harness cleans up after itself.

**The harnesses.** Three of them were measuring the wrong thing. The bar
harness's measurement program was cooked by the template literal it lived
in, and the verdict it printed - "no bar found" - was a lie. The `acum`
harness read a committed guide snapshot that was three days old while the
app reads the live source. The phone-stream harness threw away the very
evidence that tells a dead stream from a torn-down one. All three ask the
running app now, and all three fail loudly instead of quietly.

---

## 6. The 1.8.1 wave — the owner's five new reports

The owner filed five new bugs against the live site after 1.8.0. They are
recorded here in their own words, with what was measured and what was done.

| # | Report as filed | What the measurement said | What landed |
| - | --------------- | ------------------------ | ----------- |
| 1 | A fresh boot of `/` always lands first on `/conturi` — it must always be `/canale`, on mobile and in the PWA too | the catalogue pages gated on the session, and the gate could not tell *signed out* from *could not be checked*: one network hiccup at the auth server meant `/conturi` | the catalogue is public and does not gate any more; the session read has three answers and a timeout; the proxy sends any browser with a session to `/canale`; both manifests open `/canale`, and the service worker precaches the catalogue |
| 2 | On desktop, the icons/buttons overlap on hover | the bar carried a second **"Scrie o recenzie"** button — the same action the channel panel beside the picture already offers — and it could slide under the panel | the duplicate is gone; the right-hand controls are one flex group |
| 3 | The volume bar dot is too big on desktop and mobile, and on mobile it is out of position | the native knob was a 44-pixel box with a 5-pixel dot in it; on iOS `appearance-none` on the element was missing, so Safari painted its own knob | the native knob is taken away in both engines (`-webkit-appearance: none` on the input element) and the app draws its own 12-pixel dot, inset by its radius so it stands at the end of the fill at every value |
| 4 | The PWA still shows buttons under the signal bar in the iPhone notch | the header was `fixed top-0` with no safe-area padding, so in standalone mode it sat under the status bar | the header's row starts below `env(safe-area-inset-top)`; the viewport is on `viewport-fit=cover` |
| 5 | The connection loops and then drops on mobile and in the PWA — it never stays at the live moment, it plays a few moments at one sequence and then drops completely | three separate faults, found by reading the code against the measured path: a `play()` interrupted by the browser (`AbortError`) was read as a dead link and threw the player onto the next feed; the stall watchdog counted `waiting` events instead of watching the playhead, so a normal buffer refill on a slow line was read as a dead stream after fifteen seconds; and when the chain was walked out the player gave up on addresses minted minutes earlier instead of asking for a fresh chain | an interrupted start is not a failure; the watchdog counts the seconds in which the picture does not move and gives up only after twenty; the chain is asked for once more before the session is called a failure; the proxy answers inside the live window (5 s) instead of hanging for 30 s |

The live path was measured before any of it was changed: the manifest
answers in **2771 ms** (`gate 783 · claim 386 · resolve 682 · probe 705`),
the playlist carries an **8-second target duration** and 14 segments of
about **2.06 MB**, both catalogue feeds for PRO TV serve the *same* stream
(`#EXT-X-MEDIA-SEQUENCE:1447`), and the segments are real MPEG-TS
(`47 40 11 …`). The two "sources" are therefore one feed in two places —
which is why the failover had to be given a fresh chain instead of a
second copy of the same address.
