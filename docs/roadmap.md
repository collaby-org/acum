# Roadmap

Coarse. Each item is a slice, not a task list. Update this file when a slice
ships or changes shape.

## Shipped

- [x] **v1.0.0 — The catalogue.** 203 feeds, 74 families, 7 categories,
      scraped and committed as a typed module.
- [x] **v1.0.0 — The browse experience.** Hero, rails per category, full
      grid, instant search, favourites, modal player.
- [x] **v1.0.0 — Honest status.** Per-channel liveness, recorded by a probe
      and surfaced in the UI.
- [x] **v1.0.1 — Verification.** A headless driver that walks the real app,
      captures the evidence in `docs/reviews/`, and fails on console errors.
- [x] **v1.1.0 — One entry per channel.** S1/S2/S3 folded into a server
      list, with automatic fallback. See `docs/specs/catalogue-model.md`.
- [x] **v1.1.0 — Our own player.** Direct HLS through a stream proxy, own
      controls, one click to play, no ad windows. See
      `docs/specs/player-architecture.md`.
- [x] **v1.1.0 — The interface.** Apple TV rails, pointer-follow focus,
      instant ranked search, an A→Z index, recently watched.
- [x] **v1.1.0 — PWA.** Installable, offline shell, safe-area chrome.
- [x] **v1.2.0 — A second source.** 27 more channels, a second feed on 56
      others, and the programme guide.
- [x] **v1.2.0 — Measured quality.** The picture height read out of the
      segment, not the advertised codec. HD feeds are preferred.
- [x] **v1.2.0 — The logo library.** 111 high-resolution transparent
      logos from Wikimedia, 21 of them genuine HD lockups.
- [x] **v1.2.0 — Pinned channels and watch later**, local shelves.
- [x] **v1.2.0 — Fullscreen on a phone**, and the hover clipping fixed.
- [x] **v1.7.0 — The production bugs, closed.** The signed-in redirect loop,
  the pricing cards that ignored the plan, the catalogue that walked every
  slug, the player's second control bar, the iPhone safe area, and the stream
  that would not start on a phone — with the security wave that went with
  them: a token-only stream proxy, an exact host allowlist, and a desk that
  is an allowlist rather than a flag.
- [x] **v1.7.x — The channel page.** `/canal/<id>` is a shareable deep link:
  the channel's programme leads, the channel's own text follows, and the
  picture, the panel and the bottom bar fit one phone.
- [x] **v1.7.x — The release machine.** One version line that moves with
  every push, the changelog entry in the same commit as the change, the
  living documentation beside it, and a protected branch whose gate the CI
  actually reports.
- [x] **v1.7.x — The social layer.** A review is a star rating and a written
  comment on the programme airing now; the visitor sees their own review and
  can change and delete it; like, love and clap carry server-truth counters;
  the popular reviews sit below the hero on the homepage. The database is
  locked twice: row-level security for the rows, table privileges for the
  operations.
- [x] **v1.8.0 — The social layer in both apps, and the phone rules the
  television app was missing.** The review engine is mirrored into
  `monorepo/tv/`, the channel surface manages the visitor's own review, the
  composer joins the history so Back closes it, and the television app
  follows the same viewport, tap, overscroll and hover rules the web app
  already had.

## Next

### Catalogue freshness

- [ ] A scheduled workflow that re-runs the scrapers, the probe, the
      resolver and the measurement, and opens a pull request when the
      catalogue changes. The second source's tokens expire in minutes, so
      something has to keep them fresh.
- [ ] A "last checked" timestamp per channel, shown in the player modal.

### Deeper discovery

- [ ] Sort and filter inside a category rail (by status, by quality).
- [ ] A "tonight's highlights" view built from the guide, per category.

### Playback

- [ ] Keyboard shortcuts: `←`/`→` move between channels in a rail, `f`
      toggles favourites, `/` focuses search.
- [ ] Remember the last channel watched and offer "Continuă vizionarea".

### The phone, finished

The production-readiness checklist in
[#17](https://github.com/collaby-org/acum/issues/17) is the list: the install
offer only on the phone, `min-h-dvh` on every full-height surface, 16px
inputs, hover gated behind `@media (hover: hover)`, `touch-action:
manipulation`, `text-size-adjust: 100%`, one vocabulary of radius, border,
shadow and type, and three real states for every async surface. The current
state is in [backlog.md](backlog.md).

### Stream cost

- [ ] The proxy relays every video byte. Measure the real bandwidth cost
      and decide whether the manifest-only variant is enough — the segments
      are Referer-gated too, so this may not be possible.

### Presentation

- [ ] A generated poster for the channels that still have no logo, so every
      card carries a real brand mark.
- [ ] The 25 channels still on the 40×20 upstream icon: a hand-drawn mark
      would beat a blurred one.

## Not planned

- Cloud sync — the reviews are the account's, and they travel with it.
- Our own transcoding. The stream proxy is ours; the encoding is not.
- Recommendation algorithms.
- Any advertising or analytics.

## Later, maybe

- A second source site, behind the same taxonomy format, once the pipeline
  proves it can take a second input.
- A Vite/React variant of the same catalogue for embedding the directory
  inside an existing site.
