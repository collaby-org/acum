# System diagram

VIZOR is a static site. There is no server-side component, no database and
no API of its own — the only network traffic is the iframe pointing at the
upstream player.

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
   │ (105 unique URLs)│    liveness: player/blocked/…    │ (committed)            │
   └──────────────────┘                                  └───────────┬────────────┘
                                                                   │
                          scripts/build-dataset.mjs                 │
   ┌──────────────────┐    ┌───────────────────────┐               │
   │ channel-taxonomy │───▶│ src/data/channels.ts  │◀──────────────┘
   │ (names, category)│    │ (generated, committed)│
   └──────────────────┘    └───────────┬───────────┘
                                        │
   ┌──────────────────┐                │
   │ public/logos/    │◀───────────────┘  (mirrored during the build)
   │ 194 channel PNGs │
   └──────────────────┘


                          ┌───────────────────────────────────────────┐
                          │  Runtime (static Next.js 16 output)        │
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
   │   │ <Hero>   │  │ <Channel  │   │ <Player    │          │ local  │  │
   │   │          │  │  Rail>    │   │  Modal>    │          │Storage │  │
   │   └──────────┘  └───────────┘   └─────┬──────┘          │favour. │  │
   │                                        │                 └────────┘  │
   └────────────────────────────────────────┼──────────────────────────────┘
                                            │ <iframe src=embedUrl>
                                            ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  Third-party player (outside our control, may serve its own ads)    │
   │  canale-tv.net · youtube.com · cool-etv.net · *.cfd / *.shop hosts  │
   └──────────────────────────────────────────────────────────────────────┘

   Data flow of one channel, end to end:

   menu link  ──▶  /ch/<slug>.htm  ──▶  <iframe data-src>  ──▶  embed URL
                                  └──▶  acestream://<id>  (no web player)
```

## Component map

| Path | Role |
| ---- | ---- |
| `src/app/layout.tsx` | Root layout, metadata, font preload |
| `src/app/page.tsx` | Server page: passes the catalogue to the client island |
| `src/app/globals.css` | Design tokens (`@theme`), base styles, animations |
| `src/components/browse.tsx` | The client island: search, favourites, views |
| `src/components/hero.tsx` | Featured channel block |
| `src/components/channel-rail.tsx` | Horizontal scrolling rail |
| `src/components/channel-card.tsx` | Poster card, favourite toggle |
| `src/components/player-modal.tsx` | Iframe player dialog |
| `src/components/header.tsx` | Sticky navigation, search field |
| `src/components/footer.tsx` | Server-rendered footer |
| `src/components/ui/*` | shadcn-style primitives (button, badge, dialog) |
| `src/lib/channel-meta.ts` | Status metadata, colour palette, sorting |
| `src/lib/confetti.ts` | Celebration particle system |
| `src/hooks/use-favorites.ts` | `localStorage` favourites via `useSyncExternalStore` |
| `src/data/channels.ts` | **Generated** channel catalogue |
