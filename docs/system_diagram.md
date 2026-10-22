# System diagram

ACUM is a static site with a thin server for the live stream. There is no
database, no user account and no API of our own — the only server-side work
is relaying the upstream media and serving the upstream player page without
its advertising.

```
                          ┌───────────────────────────────────────────┐
                          │  Build time (Node, no server at runtime)  │
                          └───────────────────────────────────────────┘

   ┌──────────────────┐    scripts/scrape-channels.mjs   ┌────────────────────────┐
   │ cool-etv.net     │ ───────────────────────────────▶ │ data/channels.raw.json│
   │ mega-menu +      │    74 families / 203 feed pages  │ (committed)            │
   │ channel pages    │                                  └───────────┬────────────┘
   └──────────────────┘                                              │
                                                                   │
   ┌──────────────────┐    scripts/check-embeds.mjs      ┌───────────▼────────────┐
   │ embed hosts      │ ───────────────────────────────▶ │ data/embed-health.json │
   │ (105 unique URLs)│    Referer-gated, serial probe   │ (committed)            │
   └──────────────────┘                                  └───────────┬────────────┘
                                                                   │
   ┌──────────────────┐    scripts/resolve-streams.mjs            │
   │ player panels    │ ───────────────────────────────▶ ┌───────────▼────────────┐
   │ (headless Edge)  │    captures the HLS playlist   │ data/resolved-streams  │
   └──────────────────┘                                  │ .json (committed)      │
                                                           └───────────┬────────────┘
   ┌──────────────────┐    scripts/channel-taxonomy.json          │
   │ the taxonomy     │──────────────────────────────────────────▶│
   │ (names, groups)  │                                           ▼
   └──────────────────┘                            scripts/build-dataset.mjs
                                                           │
                                            ┌──────────────▼──────────────┐
                                            │ src/data/channels.ts        │
                                            │ 203 feeds → N channels,     │
                                            │ each with its server list   │
                                            └──────────────┬──────────────┘
                                                           │
   ┌──────────────────┐    mirrored during the build           │
   │ public/logos/    │◀──────────────────────────────────────┘
   │ 194 channel PNGs │
   └──────────────────┘


                          ┌───────────────────────────────────────────┐
                          │  Runtime                                   │
                          └───────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────────────┐
   │  Browser                                                             │
   │                                                                      │
   │   ┌──────────────────┐        ┌──────────────────┐                  │
   │   │ src/app/page.tsx │───────▶│ <Browse>          │  client island  │
   │   │ (server)         │  props │ (client)         │                  │
   │   └──────────────────┘        └────────┬─────────┘                  │
   │                                        │                            │
   │         ┌──────────────────────────────┼──────────────────────┐     │
   │         ▼              ▼               ▼                      ▼     │
   │   ┌──────────┐  ┌───────────┐   ┌────────────┐          ┌────────┐  │
   │   │ <Hero>   │  │ <Rail>    │   │ <Player>   │          │ local  │  │
   │   │          │  │ <Card>    │   │  Modal>    │          │Storage │  │
   │   └──────────┘  └───────────┘   └─────┬──────┘          │favour. │  │
   │                                        │                 │recent. │  │
   │   ┌──────────────────┐                │                 └────────┘  │
   │   │ <SearchPanel>    │                │                            │
   │   │ <ChannelIndex>   │                │                            │
   │   └──────────────────┘                │                            │
   └────────────────────────────────────────┼────────────────────────────┘
                                            │
              ┌─────────────────────────────┴──────────────────────┐
              │ (one click on a card — no second press)             │
              ▼                                                     ▼
   ┌────────────────────────┐                    ┌──────────────────────────┐
   │ GET /api/stream?t=…     │                    │ GET /api/player?u=…      │
   │                        │                    │                          │
   │ signed token → upstream│                    │ upstream page with every │
   │ Referer: own origin →  │                    │ ad and tracker script    │
   │ canale-tv.net →        │                    │ removed, `window.open`   │
   │ cool-etv.net           │                    │ neutralised, served with │
   │ (winner cached/host)   │                    │ a `sandbox` CSP          │
   │                        │                    │                          │
   │ playlists rewritten so │                    └───────────┬──────────────┘
   │ every segment stays    │                                │
   │ behind the proxy       │                                │ frame embeds
   └───────────┬────────────┘                                │ the panel
               │                                             │ (Referer =
               │                                             │  cool-etv)
               ▼                                             ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  Upstream media hosts — HLS manifests, variant playlists, segments     │
   │  The Referer gate is the whole reason the proxy exists: a browser    │
   │  cannot set a Referer, so the bytes have to travel through ours.     │
   └──────────────────────────────────────────────────────────────────────┘

   Nothing in the app opens a window, and nothing in the app loads a third
   party script, a tracker or an ad.
```

## Component map

| Path | Role |
| ---- | ---- |
| `src/app/layout.tsx` | Root layout, metadata, font preload, PWA registration |
| `src/app/page.tsx` | Server page: passes the catalogue to the client island |
| `src/app/globals.css` | Design tokens (`@theme`), FX utilities, base styles |
| `src/app/api/stream/route.ts` | The HLS relay — Referer chain, playlist rewriting |
| `src/app/api/player/route.ts` | The upstream player page, stripped of advertising |
| `src/components/browse.tsx` | The client island: search, favourites, views |
| `src/components/hero.tsx` | Featured channel block |
| `src/components/channel-rail.tsx` | Horizontal scrolling rail with pointer-follow focus |
| `src/components/channel-card.tsx` | Poster card, server badge, favourite toggle |
| `src/components/channel-index.tsx` | The A→Z jump bar |
| `src/components/search-panel.tsx` | Instant ranked search |
| `src/components/player/*` | The player: `hls.js`, controls, server fallback |
| `src/components/header.tsx` | Sticky navigation, search field, favourites |
| `src/components/footer.tsx` | Server-rendered footer |
| `src/components/pwa/*` | Manifest link, service worker, install prompt |
| `src/components/ui/*` | shadcn-style primitives (button, badge, dialog) |
| `src/lib/channel-meta.ts` | Status metadata, colour palette, sorting |
| `src/lib/navigation.ts` | Search matching, ranking, grouping |
| `src/lib/stream.ts` | Referer chain, allowlists, playlist rewriting |
| `src/lib/confetti.ts` | Celebration particle system |
| `src/hooks/use-favorites.ts` | Favourites and recently watched, in `localStorage` |
| `src/hooks/use-player.ts` | The playback state machine |
| `src/data/types.ts` | The catalogue contract |
| `src/data/channels.ts` | **Generated** channel catalogue |
