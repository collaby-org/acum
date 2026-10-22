# Project doc

ACUM — a Netflix-style directory of Romanian live TV channels.

## The problem

`cool-etv.net` publishes the embed URL for every Romanian TV feed, but
finding them means reading the source of an old-school table layout, and
every one of them has to be re-derived by hand. The catalogue also drifts:
the same channel appears under two names, half the family labels are
obfuscated ("HB0 R0", "PR0 - X", "L00K Tv"), and most of the upstream embed
hosts are parked or behind a bot wall.

## What ACUM is

A static web app that:

1. Scrapes the full channel menu and every channel page, recording the real
   player URL each page ships.
2. Probes each unique embed URL and records whether it actually serves a
   player.
3. Curates the result into a clean, typed catalogue with proper Romanian
   display names and categories.
4. Renders that catalogue as a browsing experience: hero, rails, grid,
   search, favourites and a modal player — with no account, no backend and
   no advertising of our own.

## Shape of the code

```
scripts/     build-time pipeline, no dependencies
data/        committed snapshots of the scrape and the liveness probe
src/app/     routes, layout, global tokens
src/components/  the UI (client island + server components)
src/components/ui/  shadcn-style primitives
src/data/    the generated catalogue
src/lib/     status metadata, colour palette, particle system
src/hooks/   localStorage favourites
public/logos/    194 channel logos
public/fonts/    self-hosted Space Grotesk + Inter
docs/        living docs (this folder)
design-system/   tokens, components, motion rules
```

## The catalogue

| Fact | Value |
| ---- | ----- |
| Channel families | 74 + 2 (the second and the third source) |
| Feeds (servers) | 370 |
| Channels | 156 — one per real broadcast, S1/S2/S3 folded in |
| Channels with more than one server | 109 |
| Feeds that answer right now | 289 of 370 |
| Channels that play right now | 112 |
| HD channels (measured) | 44 |
| Channels in the programme guide | 77 |
| Programmes in the guide | 1958 |
| Sources | 3 — 203 feeds, 83 feeds, 105 feeds |
| Categories | 7 — Generaliste, Știri, Sport, Filme, Copii, Documentare, Muzică |

`src/data/channels.ts` is generated. Edit `scripts/channel-taxonomy.json`
and re-run the pipeline.

## Naming

The source obfuscates its labels. `HB0 R0` is HBO, `Ant 1` is Antena 1,
`L00K Tv` is LOOK TV, `TELEK0M Sport` is Telekom Sport, `Caln D 1&2` is
Kanal D. The taxonomy file holds the corrected Romanian display names.

## Statuses

| Status | Meaning |
| ------ | ------- |
| `live` | The embed was verified serving a video player. |
| `blocked` | The upstream host refused the request (bot wall, parked domain). |
| `error` | The upstream host did not answer at all. |
| `acestream` | The channel uses the AceStream protocol, which has no browser player. |
| `unknown` | Not probed. |
| `none` | The source page ships no embeddable player. |

## The catalogue is split in two

The browser never holds an upstream address.

- `Channel` — what the client sees: names, artwork, status, quality.
- `UpstreamChannel` — what the server keeps: the same, plus the embed URLs,
  the source pages and the resolved playlists.

`page.tsx` projects the full catalogue down to the public one before it
reaches the client island, and the player asks the server for a feed by
reference:

```
POST /api/player { channel: "pro-tv" }
  -> { sources: [{ url: "/api/stream?t=<signed>" }, …] }
```

The served page contains no upstream host, no embed URL and no source page.
A visitor who opens the devtools panel sees our own URLs and nothing else.

## The upstream referer gate

The upstream media hosts sit behind a Cloudflare allowlist on the `Referer`
header. Measured, for both a panel host and an HLS host:

| Referer | Result |
| ------- | ------ |
| the target's own origin | 200 — real player |
| `https://www.cool-etv.net/` | 200 — real player |
| `https://canale-tv.net/` | 200 — real player |
| anything else, or none | 301 → `https://www.google.com/` |

Two consequences run through the whole project:

- A browser cannot set a `Referer`, so **the stream has to be relayed
  through the server**. `/api/stream` does that.
- A panel can only be embedded by a page on `cool-etv.net`, so the fallback
  for a feed with no resolved playlist is the cool-etv channel page itself
  (`server.sourcePage`), in a sandboxed frame.

The upstream's channel pages also call `aclib.runPop()`, which opens an ad in
a new window, and load `adexchangerapid.com`, `usrpubtrk.com` and Google
Analytics. `/api/player` removes all of it server-side and serves the page
with a `sandbox` CSP.

`blocked` is not a verdict on the channel — it records what the upstream host
did when the probe ran. The UI says so in plain Romanian.

## Rules that matter

- The app has no backend, no account and no analytics. Do not add one.
- `src/data/channels.ts` is generated. Do not hand-edit it.
- Fonts are self-hosted. No runtime CDN request.
- Colours come from the tokens in `src/app/globals.css`.
- The interface is in Romanian, with correct diacritics.
- Motion is subtle; celebration particles respect `prefers-reduced-motion`.
- Icons: `lucide-react` only. Components: shadcn-first.
- Version line: `package.json` `version` and `docs/VERSION` move together —
  one PR, one bump. Feature or architecture → minor, fix or docs or chore →
  patch, breaking → major.
- `docs/changelog.md` gets its entry in the same commit as the change.

The repository-wide agent contract lives in `AGENTS.md`, which is kept
byte-identical to the global blueprint at `~/.config/opencode/AGENTS.md`.

## The data pipeline

The channel dataset is generated, never hand-edited.

\ash
node scripts/scrape-channels.mjs         # the first source  -> data/channels.raw.json
node scripts/check-embeds.mjs            # liveness probe   -> data/embed-health.json
node scripts/resolve-streams.mjs          # headless Edge   -> data/resolved-streams.json
node scripts/scrape-secondary.mjs        # the second source-> data/secondary-sources.json
node scripts/scrape-epg.mjs              # the guide        -> data/epg.json
node scripts/scrape-canale-tv.mjs        # the third source -> data/canale-tv-channels.json
node scripts/resolve-canale-tv.mjs       # its playlists   -> data/canale-tv-streams.json
node scripts/measure-quality.mjs         # the resolution  -> data/quality.json
node scripts/measure-secondary-quality.mjs
node scripts/measure-canale-tv-quality.mjs
node scripts/fetch-logos-hd.mjs           # the logo library-> data/logo-index.json
node scripts/merge-secondary.mjs         # fold it in      -> scripts/channel-taxonomy.json
node scripts/merge-canale-tv.mjs         # and the third
node scripts/probe-feeds.mjs              # the honest probe -> data/embed-health.json
node scripts/build-dataset.mjs           # everything      -> src/data/channels.ts
node scripts/capture-posters.mjs         # the stills      -> public/posters/
\\n
scripts/channel-taxonomy.json is the hand-written editorial layer. Edit
that, never the generated module. The data/*.json snapshots are committed
so the build is reproducible without network access.

## Where the data comes from

Three public Romanian TV directories, and nothing else. Their channel
lists and their embed addresses are indexed, the streams are relayed through
our own proxy, and the visitor is never told where they came from. The
channels themselves belong to their respective owners.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static output in .next/
npm run lint
npx tsc --noEmit
```
