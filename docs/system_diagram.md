# System diagram

ACUM is two Next.js applications over one database of record. The web app
(`monorepo/frontend`) serves desktop, mobile and the installed PWA; the
television app (`monorepo/tv`) serves the remote-driven, ten-foot experience.
Both read the same catalogue, the same programme guide, the same badge
vocabulary and the same review engine, and both talk to the same Supabase
project.

```
                          ┌───────────────────────────────────────────┐
                          │  Build time (Node, no server at runtime)  │
                          └───────────────────────────────────────────┘

   ┌──────────────────┐   scripts/scrape-channels.mjs   ┌────────────────────────┐
   │ cool-etv.net     │ ──────────────────────────────▶ │ data/channels.raw.json │
   │ mega-menu +      │   74 families / 203 feed pages   │ (committed)             │
   │ channel pages    │                                 └───────────┬─────────────┘
   └──────────────────┘                                             │
                                                                     │
   ┌──────────────────┐   scripts/check-embeds.mjs     ┌───────────▼─────────────┐
   │ embed hosts      │ ──────────────────────────────▶ │ data/embed-health.json  │
   │ (105 unique URLs)│   Referer-gated, serial probe   │ (committed)             │
   └──────────────────┘                                 └───────────┬─────────────┘
                                                                     │
   ┌──────────────────┐   scripts/resolve-streams.mjs             │
   │ player panels    │ ─────────────────────────────▶ ┌───────────▼─────────────┐
   │ (headless Edge)  │   captures the HLS playlist    │ data/resolved-streams   │
   └──────────────────┘                                 │ .json (committed)       │
                                                         └───────────┬─────────────┘
   ┌──────────────────┐   scripts/scrape-epg.mjs                   │
   │ canaletvlive     │ ─────────────────────────────▶ ┌───────────▼─────────────┐
   │ (programme guide)│   1 694 programmes            │ data/epg.json           │
   └──────────────────┘                                 │ (refreshed twice a day) │
                                                         └───────────┬─────────────┘
   ┌──────────────────┐   scripts/measure-quality.mjs              │
   │ the live streams │ ─────────────────────────────▶ ┌───────────▼─────────────┐
   │ (decoded height) │   reads the real picture      │ data/quality.json       │
   └──────────────────┘                                 └───────────┬─────────────┘
                                                                     │
                                             scripts/build-dataset.mjs
                                                                     │
                                             ┌───────────────────────▼────────────┐
                                             │ src/data/channels.ts                │
                                             │ feeds → channels, each with its     │
                                             │ server list, badges and its guide   │
                                             └───────────────────────┬────────────┘
                                                                     │
                    ┌────────────────────────┬───────────────────────┴────────┐
                    ▼                        ▼                                ▼
           public/logos/*.png        public/stills/*.png               public/logos/*.png
           (the web app)             (the web app)                     (the TV app)


                          ┌───────────────────────────────────────────┐
                          │  Runtime                                   │
                          └───────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────────────┐
   │  Browser — the web app (desktop, phone, installed PWA)                    │
   │                                                                           │
   │    ┌───────────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────┐ │
   │    │ <Browse>      │  │ <Player>     │  │ <Reviews>     │  │ <Account> │ │
   │    │ search, rails │  │ hls.js, own  │  │ composer,     │  │ plan,     │ │
   │    │ favourites    │  │ controls     │  │ counters      │  │ favourites│ │
   │    └───────┬───────┘  └──────┬───────┘  └───────┬───────┘  └─────┬─────┘ │
   │            │                 │                  │                │       │
   │            └────────────┬────┴──────────────────┴────────────────┘       │
   │                         ▼                                                 │
   │            ┌────────────────────────┐                                    │
   │            │  Session (httpOnly)    │  the browser owns the refresh      │
   │            │  + the Supabase token  │  token; the mirrored cookie       │
   │            └───────────┬────────────┘  carries the access token only    │
   └────────────────────────┼─────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────────┬──────────────────────┐
        ▼                   ▼                       ▼                      ▼
┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Next.js server │  │ Supabase Auth    │  │ Supabase Postgres│  │ Stripe           │
│ (the web app)  │  │ email + password │  │ RLS + privileges │  │ checkout +       │
│                │  │ the account's    │  │ accounts, plans, │  │ webhook          │
│ /api/stream    │  │ own session      │  │ favourites,      │  │                  │
│ /api/player    │  │                  │  │ reviews,         │  │                  │
│ /api/reviews   │  │                  │  │ reactions,       │  │                  │
│ /api/account   │  │                  │  │ stream sessions  │  │                  │
│ /api/admin/*   │  │                  │  │                  │  │                  │
└───────┬────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
        │
        │  the proxy is the only way out: a signed token, an exact host
        │  allowlist, and the upstream Referer gate that a browser cannot
        │  set for itself
        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  Upstream media hosts — HLS manifests, variant playlists, segments        │
│  Nothing in the browser names an upstream address; nothing loads a        │
│  third-party script, a tracker or an ad.                                  │
└───────────────────────────────────────────────────────────────────────────┘
```

## The player's answer, phase by phase

`GET /api/player?channel=<id>` answers with the manifest the browser plays.
The answer carries a `Server-Timing` header, so every millisecond is
attributable:

| Phase | What it does | Budget |
| ----- | ------------ | ------ |
| `gate` | the account check: the session against the auth server, then the account RPC | cached 5 s per account |
| `claim` | the stream claim RPC — the visitor's own session on the stream | — |
| `resolve` | finding the feed for that channel | capped at 2.5 s |
| `probe` | checking which feed actually plays | capped at 1.2 s |

The browser then asks `GET /api/stream?t=<token>` for the bytes. The proxy
accepts **only** the signed token, checks the host against the exact
allowlist, rewrites the playlists so every segment stays behind the proxy,
and answers `no-store`.

## The review path

A review is a star rating and a written comment attached to the **programme
airing now** on a channel. The write path runs under the visitor's own
token; there is no service-role fallback.

```
visitor's token
   │
   ├─ table privileges: an anonymous visitor may only SELECT the reviews;
   │                    a signed-in visitor may read, write, change and
   │                    delete their own rows
   └─ row-level security: a review is written by its author, changed by its
                          author and deleted by its author
```

The counters are server truth: `review_reaction_counts(uuid[])` is the only
door to the private reaction rows, and it publishes the totals to everyone.

## Component map

| Path | Role |
| ---- | ---- |
| `src/app/layout.tsx` | Root layout, metadata, font preload, PWA registration |
| `src/app/page.tsx` | Server page: the catalogue, the hero, the popular reviews |
| `src/app/globals.css` | Design tokens (`@theme`), FX utilities, base styles |
| `src/app/canale/loading.tsx` | The catalogue's loading boundary |
| `src/app/api/stream/route.ts` | The HLS relay — signed token, exact allowlist, playlist rewriting |
| `src/app/api/player/route.ts` | The player manifest: gate, claim, resolve, probe |
| `src/app/api/reviews/**` | The social layer: read, write, change, delete, react |
| `src/app/api/account/**` | The account, its device, its plan |
| `src/app/api/admin/**` | The desk — an allowlist, never a flag |
| `src/app/api/checkout`, `/api/webhook/stripe` | The payments |
| `src/components/browse.tsx` | The client island: search, favourites, views |
| `src/components/channel/**` | The channel page and the panel that leads with the programme |
| `src/components/player/*` | The player: `hls.js`, the controls, the connection chip, the quality cluster |
| `src/components/reviews/*` | The composer, the cards, the counters, the popular reviews |
| `src/components/pwa/*` | Manifest link, service worker, install offer, update toast |
| `src/components/mobile-nav.tsx` | The bottom bar: prefetch on intent, the current route marked |
| `src/lib/session.ts`, `src/lib/session-token.ts` | The session, the mirrored token cookie |
| `src/lib/stream.ts` | The allowlist, the Referer chain, the playlist rewriting |
| `src/lib/reviews.ts` | The server truth of the review engine |
| `src/lib/programme-badges.ts` | The badge vocabulary, defined once |
| `src/lib/epg-source.ts`, `src/lib/guide.ts` | The programme guide and what is on now |
| `src/lib/supabase/**` | The server client and the plans |
| `src/hooks/use-reviews.ts` | The client half of the review engine |
| `src/data/channels.ts` | **Generated** channel catalogue |
| `monorepo/tv/src/**` | The television app: the same engine, the remote's own layer on top |
| `monorepo/frontend/scripts/verify-*.mjs` | The harnesses: live, player, bar, mobile, nav, reviews |
