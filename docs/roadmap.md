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

## Next

### Catalogue freshness

- [ ] A scheduled workflow that re-runs the scrapers, the probe, the
      resolver and the measurement, and opens a pull request when the
      catalogue changes. The second source's tokens expire in minutes, so
      something has to keep them fresh.
- [ ] A "last checked" timestamp per channel, shown in the player modal.

### The stills

- [x] **The clock is one clock.** "Acum" is resolved against the real clock,
      corrected by the server's stamp, and re-read every minute. The cards,
      the hero and the channel panel all read it.
- [x] **A still belongs to a programme.** The capture pipeline files every
      frame under the programme that was on air when it was taken, and the
      card picks the still of the slot on air.
- [x] **The stills refresh on a schedule** — `stills.yml`, twice an hour,
      on a self-hosted runner that can reach the upstreams.
- [ ] **A still for every channel that plays.** 20 of 156 channels carry a
      picture today; a full cycle of the catalogue takes about half an hour
      and needs a runner that is not rate-limited.
- [ ] The stills refresh without a pull request — the catalogue is baked
      into the build, so a new picture waits for a deploy.

### Deeper discovery

- [ ] A channel detail view with the family, the sibling feeds and the
      programme for the rest of the day.
- [ ] Sort and filter inside a category rail (by status, by quality).
- [ ] Shareable deep links: `/canal/<slug>` opens that channel's player
      directly, still without an account.
- [ ] A "tonight's highlights" view built from the guide, per category.

### Playback

- [ ] Picture-in-picture on the phone layout.
- [ ] Keyboard shortcuts: `←`/`→` move between channels in a rail, `f`
      toggles favourites, `/` focuses search.
- [ ] Remember the last channel watched and offer "Continuă vizionarea".

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

- Accounts, cloud sync, comments, ratings.
- Our own transcoding or stream proxy.
- Recommendation algorithms.
- Any advertising or analytics.

## Later, maybe

- A second source site, behind the same taxonomy format, once the pipeline
  proves it can take a second input.
- A Vite/React variant of the same catalogue for embedding the directory
  inside an existing site.
