# Changelog

All notable changes to VIZOR are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The version line for this project lives in `package.json` and `docs/VERSION`.

## [Unreleased]

Nothing yet.

## [1.2.0] — 2026-10-22

More channels, HD first, and the source kept out of sight.

### Added

- **A second source.** 83 channels from a second directory, of which **27 are
  new** — Acasa Gold, Acasa TV, Antena 3 CNN, Balcan Music, BBC World News,
  Cartoonito, Cinemaraton, CineWOW, Digi 24, Digi Sport 1–4, Dizi, EuroSport
  1–2, Film Now, Magic TV, MetroPola TV, MTV, Prima Sport 1–3, Pro Arena,
  Romania TV, Traditional TV, Tralala. The other 56 became a **second feed**
  on the channels we already had, which is exactly the fallback the player
  needs. The catalogue is now **143 channels and 274 feeds**.
- **Measured quality.** Every resolved feed is measured by parsing the H.264
  sequence parameter set out of a real segment — the advertised codec string
  is the same on all 89 playlists and lies about the height. Result: 8 feeds
  at 1080p, 62 at 720p, 82 at 576p. **HD is now a fact, not a guess**, and
  the servers are ordered HD first.
- **A high-resolution logo library.** 111 real logos from Wikimedia, 21 of
  them genuine HD lockups, transparent and up to 2048px wide. The 40×20
  upstream icons are now only the fallback. Dark artwork gets a light plate
  so it stays legible on a dark card.
- **Today's programme guide.** 77 channels, 1958 programmes, Europe/Bucharest.
  The hero now leads with what is on — "acum", "până la", and what follows —
  and a "Ce rulează acum pe canale VIZOR" rail puts the best of it in front
  of the visitor.
- **Pinned channels and watch later**, local-only shelves. The pins are
  ordered, and reordering is done with real buttons and arrow keys rather than
  drag and drop.
- **A working fullscreen on a phone.** The Fullscreen API does not exist for
  elements in iOS Safari, so the button used to throw and do nothing. It now
  feature-detects, falls back to Safari's native video fullscreen, tracks both
  states, and the player fills the screen on a phone the way the TV apps do.

### Fixed

- **The hover clipping.** A card that grew on hover was cut off by its rail
  and spilled over the section below. The scroller now keeps the room the
  grown card needs inside the scrollport, and the card lifts above its
  neighbours.
- **The source is nowhere in the browser.** The catalogue the client receives
  holds names, artwork, status and quality — no upstream address, no source
  page, no logo URL. The player names the channel it wants and the server
  hands back a chain of our own URLs. The served page contains no upstream
  host at all.

### Changed

- **143 channels**, up from 116; 63 playable with a verified player.
- The interface no longer mentions where the streams come from.

## [1.1.0] — 2026-10-21

The rebuild. One click to play, no ads, one entry per channel, and a PWA.

### Added

- **One entry per channel, not per feed.** The source site lists the same
  broadcast once per upstream feed — "Antena 1 S1", "Antena 1 S2 HD",
  "Antena 1 S3". Those are *servers* of one channel. The catalogue now models
  a `Channel` with a list of `Server`s, and the player walks that list until
  one works. 116 channels, 202 servers, **75 channels with more than one
  server**. See `docs/specs/catalogue-model.md`.
- **Our own player.** The upstream player is no longer embedded as-is. The app
  plays a resolved HLS playlist through its own `hls.js` instance, with its
  own controls, one click to start, and automatic fallback to the next
  server. **92 of the 116 channels play a directly resolved playlist.**
  See `docs/specs/player-architecture.md`.
- **A stream proxy** (`/api/stream`) that relays the upstream media with the
  referer the upstream requires, and a **player proxy** (`/api/player`) that
  strips the ad and tracker scripts from the upstream page before serving it.
- **Server fallback in the UI** — the card shows the server stack, the player
  shows which server it is on, and "Alt flux" moves to the next one.
- **Search panel** — instant, diacritic-insensitive, ranked, keyboard-first.
- **A→Z index** — jump to any letter of the catalogue.
- **Recently watched**, stored locally alongside favourites.
- **Apple TV rails** with pointer-follow focus, momentum and snap points.
- **A design system** — an elevation ladder, glass with specular edges,
  spring easings, film grain, and eighteen `fx-*` utilities.
- **PWA** — installable, with a manifest, real icons, an offline page, a
  service worker, and the safe-area handling an installed app needs.
- **The verification harness**, as project assets: `scripts/verify-player.mjs`
  proves one click starts the picture with no popup and no ad host, and
  `scripts/verify-fallback.mjs` proves the next server takes over.

### Fixed

- **The ad windows.** The upstream page called `aclib.runPop()`, which opened
  an ad in a new window. Nothing in the app can open a window now: the
  upstream page is served with a `sandbox` CSP, its ad scripts are removed
  server-side, and `window.open` is neutralised in the frame.
- **The double click.** Clicking a channel starts playback immediately.
- **A wrong catalogue.** 84 embeds serve a real player, not 15. The probe
  misclassified them because the panel pages contain no `<video>`, no
  `hls.js` and no `.m3u8` — only `alpha.js` and `omega1.js`.
- **A slow failover.** hls.js exhausted its twenty-second retry ladder before
  the player moved on. The manifest policy is now tuned, so a dead server
  fails over in about a second.

### Changed

- **96 of 116 channels are live** (was 19), 12 are AceStream-only and 8 are
  genuinely dead upstream.
- The catalogue is now a snapshot of 116 channels, not a list of 203 feeds.

## [1.0.1] — 2026-10-21

### Fixed

- **The player modal had no visible close button.** `hideClose` removed the
  dialog's built-in control, so the only ways out were Escape and a click on
  the backdrop. Added a close control over the video stage.
- **The CI type check failed on a clean checkout.** `LayoutProps` and the
  other route-type helpers are generated by `next typegen`, which CI never
  ran. Added a `typecheck` script (`next typegen && tsc --noEmit`) and
  pointed the workflow at it.
- **The CI actions were pinned to a stale `actions/setup-node` v2 SHA**, which
  rejected the `cache` input and could no longer call `add-path`. Moved
  `actions/checkout` and `actions/setup-node` to their current majors and
  `gitleaks/gitleaks-action` to v3.

### Added

- `scripts/verify-ui.mjs` — drives the production build in headless Edge
  over the DevTools protocol: it clicks through the hero, the favourite
  toggle, the player and the search, captures screenshots into
  `docs/reviews/`, and fails on any browser console error. No dependencies.
- `docs/reviews/` — the captured evidence for the release.

## [1.0.0] — 2026-10-21

First public release.

### Added

- **Catalogue of 203 Romanian TV feeds** across 74 channel families and 7
  categories, scraped from `https://www.cool-etv.net/` with
  `scripts/scrape-channels.mjs` and committed as a typed module in
  `src/data/channels.ts`.
- **Embed liveness probe** (`scripts/check-embeds.mjs`) that records, per
  unique embed URL, whether the upstream host actually serves a player
  (`live`), refuses the request (`blocked`), or does not answer (`error`).
  19 channels were verified playable at release time.
- **Netflix-style browse experience**: hero with a featured live channel,
  horizontal rails per category, and a complete grid of every channel.
- **Instant search** across channel name, family and category, diacritic
  and case insensitive (`⌘K` / `Ctrl+K` focuses the field).
- **Favourites** stored in `localStorage` — no account, no server, no cookie.
- **Modal player** that embeds the upstream player in a sandboxed iframe and
  shows the source page and the raw embed URL for every channel.
- **Celebration particles** (`canvas-confetti`) when a channel is added to
  favourites, with a reduced-motion fallback.
- **Self-hosted brand fonts** (Space Grotesk for display, Inter for UI) in
  latin and latin-ext, so the app makes no third-party font request.
- **Channel logos** mirrored into `public/logos/` (194 PNGs) so the UI never
  hotlinks the source site.
- **Repository standards**: `AGENTS.md`, `CONTRIBUTING.md`, `CLAUDE.md`,
  `SECURITY.md`, PR and issue templates, `CODEOWNERS`, `dependabot.yml`, and
  SHA-pinned CI and secret-scan workflows.

### Known limitations

- 23 channels are AceStream-only. That protocol has no browser player, so
  they are listed with a "Necesită plugin" status and no player.
- The majority of upstream embed hosts sit behind a Cloudflare wall that
  refuses requests from datacenter networks. Those channels are marked
  "Indisponibil" and may still play from a residential connection.
- Two channels (Moldova 1, Publika TV) publish a plain HLS playlist on the
  source site; both were unreachable at release time.

[Unreleased]: https://github.com/collaby-org/vizor/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/collaby-org/vizor/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/collaby-org/vizor/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/collaby-org/vizor/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/collaby-org/vizor/releases/tag/v1.0.0
