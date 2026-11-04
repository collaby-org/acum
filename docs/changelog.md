# Changelog

All notable changes to ACUM are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The version line for this project lives in `package.json` and `docs/VERSION`.

## [Unreleased]

## [1.7.0] — 2026-11-04

### Fixed

- **The landing page no longer flashes for a signed-in visitor.** The front door
  used to redirect on the mere *presence* of a session cookie, so a visitor
  returning with an expired token was bounced to the catalogue, refused there,
  sent back to the accounts page, and sent round again. The cookie is now read
  as a session: while the access token is still fresh the visitor goes straight
  to the catalogue; when it has expired the browser refreshes it and the gate
  replaces the history entry with `/canale`. The server never touches the
  refresh token — Supabase rotates refresh tokens and treats a reuse as a
  possible theft, so the browser keeps it and the server keeps the access
  token alone.
- **The pricing cards tell the truth about the plan you are on.** The plan you
  already hold reads **"Planul tău"**; a cheaper plan is refused with
  **"Ești deja pe un plan superior"** and its button is disabled; a richer plan
  reads **"Treci la \<Plan\>"**. Every button is at least 44 px tall, and the
  grid keeps its height so the page does not jump.
- **The catalogue answers in a fraction of a second.** The programme guide used
  to walk all 74 channel slugs on every request — five to seven seconds of
  waiting for one channel. The guide is now read from the upstream's
  per-channel JSON endpoint, one request for the channel that was asked for.
  `/api/channel/<id>` answers in well under a second.
- **The player's controls live in one bar inside the frame.** There is no more
  bar under the video and no more row of icons that shifted on hover. The bar
  reveals itself on hover on a desktop and hides after three seconds; on a
  phone one tap reveals it and it hides after four seconds, and that tap never
  starts or stops the video by accident. Every control is at least 44 × 44 px.
- **The iPhone safe area is respected.** `viewport-fit=cover` is set, and the
  player frame, the control bar, the mobile navigation and the player dialog
  all keep their distance from the notch and the home indicator.
- **The stream starts on a phone and in the installed app.** When iOS refuses
  to play an unmuted stream (`NotAllowedError`), the player mutes itself and
  retries the same source, then walks to the next source when that source is
  dead. The Romanian loading notice sits on the picture, small and readable.

### Security

- **The stream proxy answers only to a signed token.** `/api/stream` takes the
  opaque token minted by `/api/player` and nothing else; the plain `?u=`
  address form is gone.
- **The browser can no longer name an upstream address.** `/api/player` takes
  a channel id and resolves the feed from the catalogue; the branch that
  accepted a list of `servers[]` from the caller is deleted, and `/api/resolve`
  answers under the same paywall gate.
- **The upstream allowlist is an exact list of hosts.** Shared suffixes such as
  `.cfd` or `.shop` are no longer accepted — that suffix list had turned the
  proxy into an open egress. Redirects are followed by hand, at most three
  hops, and every hop is checked again, including against private, loopback
  and link-local addresses.
- **The token key is no longer in the source.** `STREAM_TOKEN_SECRET` is used
  when it is set; otherwise the key is derived from the Supabase service key
  with HMAC-SHA256. When neither is available the proxy fails closed instead
  of guessing.
- **The desk is an allowlist, not a flag.** `profiles.bypass` lifts the
  paywall and nothing else. The desk is opened by the `ADMIN_EMAILS` list or
  by the `comp` plan, the browser is told only whether the door is open, and
  the owner's e-mail is no longer written into the client bundle.
- **The account-state functions are server-only.** `account_state` and
  `minutes_watched_today` are revoked from `anon` and `authenticated` and
  granted to `service_role`, so a browser cannot read another account's plan
  or watch time.
- **Messages are readable only by the desk.** The `messages` select policy no
  longer answers every signed-in visitor.
- **The account gate fails closed.** A failed read is a refusal, not a
  permission.

### Changed

- **Next.js 16 renamed the front door.** `middleware.ts` is now `proxy.ts`
  (`proxy` is the new export), because the old file convention is deprecated
  in the framework version this app runs on.
- **The secret scan runs again.** The workflow downloaded Gitleaks from a URL
  that no longer exists, so the job died before it scanned anything. It now
  installs the pinned release `v8.30.1` and verifies its checksum.
- **Version 1.7.0** — the frontend app, the TV app and `docs/VERSION` move
  together, because the architecture changed as well as the behaviour.

## [1.6.0] — 2026-11-02

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

### Fixed — the programme was gone from the channel page

- **The panel answered with yesterday's schedule while the catalogue beside
  it answered with today's.** The catalogue pages read the guide from the
  source at runtime, behind Next's cache, one walk of the source every three
  hours; the channel panel read the committed snapshot off the disk. The
  snapshot had expired, so `/canal/pro-tv` showed the channel's long
  description and **no programme at all** — the one thing a channel page is
  for. Both now read the same guide through the same two sources, in the
  same order, and the panel gets a guide that keeps its descriptions.
- **The panel led with the channel instead of the programme.** It now opens
  with what is on: the title, the hours it runs, its own description; then
  what follows; and only then the channel's own words, under "Despre
  canal". A channel the guide has nothing for says so — it never falls
  back to the channel blurb as if that were the programme.

### Fixed — the landing page

- **React error #418 on every visit to `/`.** The prices are regional, and
  the grid was rendered without a region: the server painted euros, the
  browser painted the visitor's own currency, and the two trees disagreed.
  The region is now read from the geo header on the server, the way the
  pricing page reads it, so there is one price painted once.
- **Sixteen pixels of horizontal overflow on a phone.** The glow under the
  pricing section was drawn wider than the screen, so the landing page
  could be dragged sideways and its right edge was cut.

### Fixed — the phone and the installed app

- **The install offer was shown on a desktop.** A desktop browser is a
  website and should stay one; the offer belongs to the phone. Where the
  browser fires its own install event, that is the path — the share-sheet
  recipe is the fallback, not the other way round — and the card's own
  controls are 44px.
- **The shell was taller than the screen.** `min-h-screen` is the *large*
  viewport on a phone, so the bottom bar and the last rail drifted under
  the browser chrome. It is `min-h-dvh` now, everywhere.
- **The inputs were small enough to make iOS zoom the page.** Every field
  is at least 16px on a phone.
- **The hover effects stayed on after a tap.** A finger leaves a hover
  behind, so every hover rule now lives behind `@media (hover: hover)`.
- **The app pulled to refresh and inflated its own type.** The page is an
  app, not a document: no pull-to-refresh, no rubber band, no text
  inflation of its own, and a tap answers at once.
- **The service worker kept every old release forever.** The hashed assets
  are evicted on each activation; the shell and the pages stay.

### Fixed — the player

- **The live bar pretended to be a scrubber.** At the live edge there is no
  position to seek to, and the 6px range input was untouchable. It is now
  an honest buffer line, labelled in Romanian, with the "În direct" mark
  beside it.
- **Every control was 36×36.** They are 44×44 now, on the desktop and on
  the phone, with one size for the icons and one for the labelled chips,
  and the volume slider has a 24px thumb and a visible value.
- **"Se caută fluxul…" could sit there for ten seconds.** The connecting
  state now says what it is doing, with a spinner over the black frame,
  and a watchdog gives up after twenty seconds instead of hanging.

### Changed

- **The installed app opens on the landing page**, with shortcuts to the
  full catalogue and to search.
- **One quality label per channel.** The trending rows used to print four
  pills in a row — `SD · AD · S · Știri` — and three of them were about
  the channel rather than the programme. A channel now carries one quality,
  the category is plain text, and the vocabulary is the industry's: UHD /
  FHD / HD / SD, 5.1 / Atmos / Spatial, AD / S / SSL / CC, and the US and
  UK maturity scales. Nothing is claimed that the data cannot support.
- **One version line.** `docs/VERSION` said 1.3.0 while the packages said
  1.5.1 — the monorepo restructure had rolled it back. The line is 1.6.0
  in all three places, and the changelog carries the four releases that
  shipped without an entry.

### Added

- **A production-readiness issue** (#17) covering every flow, the player
  and its buffering, the navigation, the errors, the consistency and the
  badge vocabulary — each item marked as observed on the live site or
  found in the source.
- **The television app gets the same CI.** Lint, type check and build are
  now a job of their own, so a television release cannot be broken by the
  web app and cannot break it.

## [1.5.1] — 2026-10-22

The stream token, the failover chain, the directory, the player modal and the
stills. This release shipped with a version line but without a changelog
entry; the summary is recovered from the release commit.

## [1.5.0] — 2026-10-22

A signed-in visitor is visible to the server. This release shipped with a
version line but without a changelog entry; the summary is recovered from
the release commit.

## [1.4.0] — 2026-10-22

Accounts, the admin desk, twenty-two pages, the intro, the real clock and the
measured audience. This release shipped with a version line but without a
changelog entry; the summary is recovered from the release commit.

## [1.3.0] — 2026-10-22

A third source, a new name and a measured audience. This release shipped with
a version line but without a changelog entry; the summary is recovered from
the release commit.

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
