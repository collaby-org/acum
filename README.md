# VIZOR

**TV live românesc, fără reclame și fără cont.**

A Netflix-style directory of Romanian live TV, built from the public embed
addresses published on [cool-etv.net](https://www.cool-etv.net/).

![Next.js](https://img.shields.io/badge/Next.js-16.4.2-000?logo=next.js) ![React](https://img.shields.io/badge/React-19.3-087ea4?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript) ![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss) ![License](https://img.shields.io/badge/license-MIT-10b981)

---

## What it is

- **One click to play.** Click a channel, the picture starts. No poster, no
  second press, no "click to start" round trip.
- **Our own player.** Not the upstream's chrome — a live-edge-locked
  scrubber, volume, Picture-in-Picture, fullscreen, and a breathing live
  indicator.
- **No ads, and no way for an ad to open.** The upstream player calls
  `aclib.runPop()`, which throws an ad into a new window. VIZOR serves the
  upstream page with every ad and tracker script removed, under a `sandbox`
  CSP, and streams the media through its own proxy. The network log shows
  zero ad hosts and zero popups.
- **One entry per channel, not per feed.** The source lists the same
  broadcast once per upstream server — "Antena 1 S1", "Antena 1 S2 HD",
  "Antena 1 S3". VIZOR folds those into one channel with a server list, and
  when a feed goes down it falls back to the next one automatically.
- **Find anything, fast.** Instant ranked search, diacritic-insensitive, and
  an A→Z jump bar.
- **No account.** Favourites and recently-watched live in `localStorage`.
- **Installable.** A PWA with an offline shell, real icons and safe-area
  chrome, so it behaves like an app on a phone.
- **No analytics, no trackers, no ad scripts of our own.** The interface
  says "0 reclame" because it is true.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Node.js 20.9 or newer.

```bash
npm run lint        # ESLint (flat config)
npm run typecheck   # next typegen && tsc --noEmit
npm run build       # Turbopack production build
```

## How the catalogue is built

The channel list is generated, not hand-written. The pipeline lives in
`scripts/` and uses only Node built-ins:

```bash
npm run data:scrape    # cool-etv.net           -> data/channels.raw.json
npm run data:probe     # liveness probe         -> data/embed-health.json
npm run data:resolve   # headless Edge, HLS URLs-> data/resolved-streams.json
npm run data:build     # merge + logos          -> src/data/channels.ts
```

`scripts/channel-taxonomy.json` is the editorial layer: the source obfuscates
its labels (`HB0 R0` is HBO, `Ant 1` is Antena 1, `L00K Tv` is LOOK TV), so
every family and feed gets a corrected Romanian display name and a category.

`src/data/channels.ts` is generated — do not edit it by hand.

## The referer gate

The upstream media hosts sit behind a Cloudflare allowlist on the `Referer`
header. With the right referer they serve a real player; with any other they
answer `301 → google.com`. A browser cannot set a `Referer`, so the stream is
relayed through `/api/stream`. The full measurement, and what it forces on
the architecture, is in [docs/specs/player-architecture.md](docs/specs/player-architecture.md).

## Verifying it

```bash
npm run verify:player     # one click -> moving picture, no popup, no ad host
npm run verify:fallback   # kill the first server -> the next one takes over
npm run verify:ui         # walk the app, capture docs/reviews/
```

`verify:player` drives headless Edge over the DevTools protocol, dispatches a
real mouse click on a channel card, and fails unless the picture advances and
no ad host or new window appears.

## Project layout

```
scripts/           build-time pipeline + the verification harness
data/              committed snapshots of the scrape, the probe and the resolve
src/app/           routes, layout, API handlers, design tokens
src/components/    the UI
src/components/ui/ shadcn-style primitives
src/data/          the catalogue contract and the generated catalogue
src/lib/           status metadata, palette, navigation, stream, particles
src/hooks/         favourites, recently watched, the playback state machine
public/logos/      194 channel logos
public/fonts/      self-hosted Space Grotesk + Inter
public/icons/      the PWA icons
design-system/     tokens, components, motion rules
docs/              living docs
docs/specs/        the load-bearing decisions
```

## Documentation

- [docs/project-doc.md](docs/project-doc.md) — what the project is and how it
  is built
- [docs/system_diagram.md](docs/system_diagram.md) — architecture
- [docs/tech_stack.md](docs/tech_stack.md) — pinned versions
- [docs/targets.md](docs/targets.md) — scope and quality bar
- [docs/roadmap.md](docs/roadmap.md) — what is next
- [docs/changelog.md](docs/changelog.md) — release history
- [docs/specs/catalogue-model.md](docs/specs/catalogue-model.md) — why one
  entry per channel
- [docs/specs/player-architecture.md](docs/specs/player-architecture.md) — how
  the player works and why
- [design-system/DESIGN_SYSTEM.md](design-system/DESIGN_SYSTEM.md) — tokens,
  components, motion rules
- [AGENTS.md](AGENTS.md) — the contract for agents and contributors
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Every change lands through a pull
request, and the template asks for evidence and a `version: before → after`.

## Security

See [.github/SECURITY.md](.github/SECURITY.md). Report vulnerabilities privately
through GitHub's security advisory form.

## Licence

MIT — see [LICENSE](LICENSE).

The channels themselves belong to their respective owners. VIZOR indexes the
public embed addresses published by the source site and links back to it.
