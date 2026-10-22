# Verification evidence

Four harnesses, all of them driving the real production build in headless
Edge over the DevTools protocol. They are project assets, not one-off
scripts — they are the evidence behind the release claims.

```bash
npm run build
npx next start --port 3115

npm run verify:player     # one click -> moving picture, no popup, no ad host
npm run verify:fallback   # kill the first server -> the next one takes over
npm run verify:ui         # walk the app, capture these screenshots
npm run verify:acum       # "acum" is on the real clock, and it moves
```

`EDGE_PATH` overrides the browser binary.

## `verify:player` — one click, no ads, no window

It dispatches a real mouse click on a channel card, then waits for the
picture. It fails unless the video is playing, the clock is advancing, no ad
host was contacted and no new page target appeared.

```
clicking: Vizionează Antena 1, live acum, de servere
video: {"hasVideo":true,"hasDialog":true,"readyState":4,"currentTime":1.523597,
        "paused":false,"w":1280,"h":720}
after 4s: {"readyState":4,"currentTime":5.542699}

=== ad hosts ===            none
=== upstream hosts ===      none
=== console ===            (empty)

RESULT: PASS
{
  "readyState": 4,
  "currentTimeStart": 1.523597,
  "currentTimeEnd": 5.542699,
  "delta": 4.019102,
  "adRequests": 0,
  "newPageTargets": 0,
  "videoSize": "1280x720",
  "paused": false
}
```

The upstream hosts line is the important one: **the browser never contacts an
upstream host at all.** The stream arrives through `/api/stream` with a
signed token, so the upstream player and its ad scripts never run.

## `verify:fallback` — the next server takes over

It kills the first stream request on purpose. The player has to notice and
move to the next server of the same channel.

```
channel under test: PRO TV
killed requests: 1
stream requests: 7
distinct stream links: 6
video: {"readyState":4,"currentTime":0.645259,"paused":false}
after 4s: {"readyState":4,"currentTime":4.656512}

RESULT: PASS
```

## `verify:ui` — the walkthrough

Captures the screenshots in this folder and fails on any console error.

| File | What it shows |
| ---- | ------------- |
| `01-home.png` | The home screen at 1440×900 — hero, header, the first rail. |
| `02-home-full.png` | The whole page: every category rail, the A→Z index, the colour-per-category system. |
| `03-favourite-confetti.png` | A channel added to favourites — the counter updates, the heart fills, the celebration particles fire. |
| `04-player-modal.png` | The player with its own transport bar, the live indicator, the server stack and the source link. |
| `05-search.png` | Search for "hbo" — five results, diacritic-insensitive, grouped by category. |
| `06-mobile.png` | The home screen at 390×844. |

```
[title] ACUM — TV live românesc, fără reclame
[counts] {"cards":329,"rails":11,"h1":"AMC"}
[search] {"results":5,"body":"5 DE REZULTATE FILME 5 HBO HBO S1 · S2 LIVE HBO 2 …"}
[console errors] none
```

## `verify:acum` — the clock, and the proof that it moves

The programme guide says what is on between two absolute timestamps and
nothing about the present, so "what is on now" is a question about the
clock. The harness asks that question of the running app and insists on
the truth:

- the card names the programme that is on air **at the real clock**, and
  not the one that was on when the guide file was written;
- the card **moves** when the clock moves — the page is not reloaded, the
  minute tick is what changes it;
- the channel panel names the programme that is on air now, asks the server
  again on the minute, and prints the new programme at the changeover.

The page's own clock is pushed forward with the DevTools virtual clock, so
the second proof takes seconds instead of a minute. The panel is answered
by the server, so its proof waits for the real clock to turn the minute
over.

```
channel:  tvr-3 (TVR 3)
guide:    2026-10-22, written 2026-10-22T00:37:40.924Z
at the file's own stamp the guide said: Cântec și poveste
panel:    TVR 3 — Provocarea regiunilor
PASS  the panel is on the page
PASS  the panel names the programme on air at the real clock — the panel says "Provocarea regiunilor", the guide says "Provocarea regiunilor"
PASS  the panel asks the server again on the minute — 1 request(s) when it opened, 2 after 75 seconds
PASS  the answer the panel prints follows the clock — it said "Provocarea regiunilor", now it says "Mașina timpului"
PASS  the panel moved with the real clock — it said "Provocarea regiunilor", now it says "Mașina timpului"
PASS  the card is on the page
PASS  the card names the programme on air at the real clock — the card says "Mașina timpului", the guide says "Mașina timpului"
PASS  the card does not name the programme the guide file was written at — the card says "Mașina timpului", the file's own stamp said "Cântec și poveste"
PASS  the page was not reloaded — the marker is there
PASS  the card moved with the clock — it said "Mașina timpului", now it says "Telescoala in limba maghiara"
PASS  the card names the programme that is on now — the card says "Telescoala in limba maghiara", the guide says "Telescoala in limba maghiara"

11/11 checks passed
```

The screenshots and the report of the run are in `acum/`:

| File | What it shows |
| ---- | ------------- |
| `acum/01-card.png` | The card with the programme that is on at the real clock. |
| `acum/02-card-after.png` | The same card, thirty minutes later: the picture and the title have moved. |
| `acum/03-panel.png` | The channel panel with its own *Acum*. |
| `acum/report.json` | Every check of the run, with what it compared against. |
