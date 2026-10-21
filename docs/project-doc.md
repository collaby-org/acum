# Project doc

VIZOR — a Netflix-style directory of Romanian live TV channels.

## The problem

`cool-etv.net` publishes the embed URL for every Romanian TV feed, but
finding them means reading the source of an old-school table layout, and
every one of them has to be re-derived by hand. The catalogue also drifts:
the same channel appears under two names, half the family labels are
obfuscated ("HB0 R0", "PR0 - X", "L00K Tv"), and most of the upstream embed
hosts are parked or behind a bot wall.

## What VIZOR is

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
| Channel families | 74 |
| Feeds | 203 |
| Unique embed URLs | 105 |
| Feeds with an iframe embed | 180 |
| Feeds verified playable | 19 |
| Feeds behind a bot wall | 157 |
| AceStream-only feeds | 23 |
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
| `blocked` | The upstream host refused the request (Cloudflare wall, parked domain). |
| `error` | The upstream host did not answer at all. |
| `acestream` | The channel uses the AceStream protocol, which has no browser player. |
| `unknown` | Not probed. |
| `none` | The source page ships no embeddable player. |

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

```bash
node scripts/scrape-channels.mjs   # cool-etv.net -> data/channels.raw.json
node scripts/check-embeds.mjs      # liveness probe -> data/embed-health.json
node scripts/build-dataset.mjs      # merge + logos -> src/data/channels.ts
node scripts/fetch-fonts.mjs        # self-host the brand fonts
node scripts/verify-ui.mjs <url>    # headless UI verification -> docs/reviews/
```

`scripts/channel-taxonomy.json` is the hand-written editorial layer. Edit
that, never the generated module. `data/channels.raw.json` and
`data/embed-health.json` are committed so the build is reproducible without
network access.

## Where the data comes from

`https://www.cool-etv.net/` — the public channel directory. VIZOR indexes
the embed addresses it publishes and links back to it. The channels
themselves belong to their respective owners.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static output in .next/
npm run lint
npx tsc --noEmit
```
