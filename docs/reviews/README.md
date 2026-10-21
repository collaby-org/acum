# Verification evidence

Screenshots captured by `scripts/verify-ui.mjs`, which drives the real
production build in headless Edge over the DevTools protocol and writes the
result here.

```bash
npm run build
npx next start --port 3111
node scripts/verify-ui.mjs http://127.0.0.1:3111/
```

| File | What it shows |
| ---- | ------------- |
| `01-home.png` | The home screen at 1440×900 — hero, header, the first rail. |
| `02-home-full.png` | The whole page: every category rail, showing the colour-per-category system. |
| `03-favourite-confetti.png` | A channel added to favourites — the header counter updates, the heart fills, the celebration particles fire. |
| `04-player-modal.png` | The player modal with the real Antena 1 stream rendering inside the upstream iframe, plus the status badge, the favourite action and the raw embed URL. |
| `05-search.png` | Search for "hbo" — 10 results, diacritic-insensitive. |
| `06-mobile.png` | The home screen at 390×844. |

The script also fails loudly on any browser console error; the last run
reported `none`.

## What the run asserted

```
[title] VIZOR — TV live românesc, fără reclame
[counts] {"cards":234,"rails":10,"h1":"Antena 1"}
[modal] {"dialog":true,"iframe":"https://canale-tv.net/channel-v2/a1.html",
         "text":"Antena 1 Player live pentru Antena 1 ÎN DIRECT ANTENA 1 …"}
[search] {"h1":"10 de rezultate","results":10}
[console errors] none
```
