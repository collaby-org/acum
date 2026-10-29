# Changelog

All notable changes to ACUM are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The version line for this project lives in `package.json` and `docs/VERSION`.

## [Unreleased]

### Added — the ten-foot layer (`monorepo/tv`)

- **A design system for three metres.** A type scale that starts where the web
  scale ends — body copy at 19px, the hero past five rem. A focus ring that is a
  bar of gold held off the element by a dark gap, with a bloom behind it, so a
  remote always knows where it is. Safe-area inset for a set that overscans.
- **The cursor rule.** The cursor is absent until a pointer actually moves. The
  state is written in the server-rendered markup, so a television never sees a
  frame with an arrow on it; the first genuine mouse movement brings it back, and
  the next keypress takes it away.
- **A D-pad engine** in `src/hooks/use-remote-nav.ts`. One `window` keydown
  listener, geometric spatial navigation over `[data-tv-nav]` scopes, and
  *real* DOM focus — no selected index kept in React state, no synthetic click on
  Enter, because the browser already does that and cannot get out of step with
  the DOM.
- **Rails that wrap, and remember where you were.** `"x"` wraps the horizontal
  axis and nothing else, so a vertical key falls *out of* a row to the one below
  it; and `src/hooks/use-focus-loop.ts` puts a row's focus back when its cards
  re-render, in a row that has actually held focus. A remote with a dead D-pad
  looks exactly like a broken app, and there is no mouse to click out of it.
- **The remote-driven components**: `TVNav`, `TVHero`, `TVChannelRow`,
  `TVChannelCard`, `TVFocusable`, `TVSafeArea`, `TVShell`, and the `/tv` front
  door they compose into — a hero banner over one row per category, reachable
  with four arrows and a select button. The card reuses the shared catalogue
  card's screen unchanged; a television changes what is around it.
- **Ten dead links closed.** `/contact`, `/propune-un-canal`, `/admin`,
  `/reset-password` and the five legal pages were removed from the TV build
  along with a whole footer column, because a navigation that promises a
  destination the app does not have is worse than no navigation.

### Changed

- **The product is now ACUM.** The name was VIZOR; it is now **ACUM** — Romanian
  for *now*, which is what the product is about: what is on now, what is
  trending now, how many people are watching now. The name carries no
  diacritics, so nothing is lost in a URL, a file name or a home-screen label.
- **A new identity, built from scratch.** The mark is a capital **A** — the
  first letter of the name — with a bright rail running out of it to the
  right: the playhead, the position of *now* on the programme guide. The old
  gold rounded square with the television glyph is gone, everywhere: the
  header, the footer, the app icon, the maskable icon, the Apple touch icon,
  the favicon and the Open Graph card.
- **The wordmark is type, not a picture.** The Romanian word, set in Space
  Grotesk 700, tracked `0.16em`. The A in the wordmark is the A in the mark.
- **The manifest, the service worker and the metadata carry the new name.**
  The service worker's caches are namespaced `acum-*`, the iOS home-screen
  title is `ACUM`, and the title, description and keywords are rewritten
  around *acum* rather than around the old name.
- **Favourites, history, pins and watch-later move across.** The shelves are
  read from their old `vizor:` keys once and written to the new `acum:` keys,
  so nothing a visitor had saved disappears because of the rename.
- **The repository is now `collaby-org/acum`.** The package name, the
  repository and homepage URLs, the security advisories, the contributor
  documents and the CI badge all point at the new path. The canonical origin
  is still the project's own home — the app has no domain of its own yet, so
  `metadataBase` points at `https://collaby-org.github.io/acum` and the
  canonical link is `/`.
- The canonical origin, the robots file, the sitemap, the README, the licence
  and the contributor documents all say ACUM.

### Added

- `scripts/build-icons.mjs` draws the mark once and composes every raster
  asset from it — the app icons, the maskable icons, the Apple touch icon and
  the multi-size favicon. Change the geometry there, not in a text editor.
- `public/brand/og.png`, the 1200 × 630 Open Graph card.

### Added

- **A third source.** `canale-tv.net` publishes a channel directory of 105
  channels. Every one of them resolves to a real playlist, and the resolver
  that undoes the obfuscation was written for that site long ago — we had
  simply never read its index. **73 of them are a second or third feed on
  channels we already had, which is the fallback the player needs, and 13
  are new**: BBC NEWS, PRIMA SPORT 4, PRIMA SPORT 5, PPV 1–3, SPORT EXTRA,
  WARNER TV, BBC FIRST, NAT GEO PEOPLE, TRAVEL MIX, HGTV and Canal 33.
- **The catalogue is 156 channels and 370 feeds**, of which **112 play
  right now** and **109 have more than one feed**. The count of live
  channels was wrong before — it said 71 while 130 answered — because the
  catalogue's status field had gone stale. It is now re-probed from scratch
  through the real playback path.
- **An audience we measure ourselves.** The proxy sees every segment
  request of every viewer, so it counts the distinct browsers watching each
  channel over the last ninety seconds. That is a real crowd. The
  directories' own counter is cumulative — sampled twice, seventy seconds
  apart, only 2 of 83 channels moved — so it is kept, and labelled
  *popularitate*, and never dressed up as a live count.
- **A channel panel** under the player: the viewer count, the current
  programme with the times it started and ends, the category, what follows
  and a short description of the channel.
- **A channel route** at `/canal/<id>` — the phone's player. A dialog on a
  390 pixel screen is a picture with a caption under it and no way out; this
  is a page with a visible *Înapoi* control that works inside an installed
  app, where there is no browser chrome to fall back on.
- **A bottom bar** on the phone layout, safe-area aware, with *Acasă*,
  *Categorii*, *Favorite* and *Caută*.
- **An unmute affordance**: a large target over the picture and a pill that
  stays on the transport bar, so a muted channel never looks broken.
- **A still of the show on air** as the card's backdrop, taken from the
  broadcast itself.

### Changed

- **The hero is a programme guide.** It leads with the most trending channel
  at that moment, names the show that is on, says when it started and ends,
  and lists what follows.
- **The trending rail is a ranking, not a timetable.** It is ordered by who
  is watching, and it carries the count.
- **The card** reads *name + quality* on the first line and *what is on now*
  on the second, over a beam of the channel's own colour, with the still
  behind it.
- **Empty shelves are invisible.** *Fixate* and *Mai târziu* appear only
  once there is something in them.
- **156 channels**, 44 of them measured as HD.

### Fixed

- **The source is nowhere in the browser.** The framed fallback is gone. It
  never worked — the upstream hosts answer a request that does not carry
  their own Referer with a redirect to Google, so a frame from our own
  origin showed Google's page — and the page it pointed at carried the name
  of the site we relay. Every byte that reaches the browser now goes through
  the stream proxy.
- **A poster could photograph the upstream's page.** The capture fell back
  to a page screenshot when the player was an embedded frame, which put the
  directory's own words into a card's backdrop. A poster is now only ever
  the pixels of our own `<video>`.
- **Two counts for "live", and two rules for "playable".** The interface
  had two copies of the second, and the one in use emptied the rail of live
  channels.
- **Some upstream hosts are spelled in Unicode**, and a signature computed
  over one spelling does not match the other.

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
  and a "Ce rulează acum pe canale ACUM" rail puts the best of it in front
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

[Unreleased]: https://github.com/collaby-org/acum/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/collaby-org/acum/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/collaby-org/acum/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/collaby-org/acum/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/collaby-org/acum/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/collaby-org/acum/releases/tag/v1.0.0
