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

## Next

### Catalogue freshness

- [ ] A scheduled workflow that re-runs `scrape-channels.mjs` and
      `check-embeds.mjs` weekly and opens a pull request when the catalogue
      changes. This keeps `status` honest without a human in the loop.
- [ ] Re-resolve the HLS playlists on a schedule. The tokens are stable
      today, but nothing guarantees they stay that way.
- [ ] A "last checked" timestamp per channel, shown in the player modal.

### Deeper discovery

- [ ] A channel detail view with the family, the sibling feeds and the
      direct source link, reachable from the card rather than only the
      player.
- [ ] Sort and filter inside a category rail (by status, by family).
- [ ] Shareable deep links: `/canal/<slug>` opens that channel's player
      directly, still without an account.

### Playback

- [ ] Remember the last channel watched locally and offer "Continuă
      vizionarea" on the home hero.
- [ ] Picture-in-picture for the player.
- [ ] Keyboard shortcuts: `←`/`→` move between channels in a rail, `f`
      toggles favourites, `/` focuses search.

### Stream cost

- [ ] The proxy relays every video byte. Measure the real bandwidth cost
      and decide whether the manifest-only variant is enough — the segments
      are Referer-gated too, so this may not be possible.

### Presentation

- [ ] Higher-resolution channel logos. The source publishes 40×20 PNGs; the
      app would need an upscaling or a vector source.
- [ ] A generated poster for channels whose logo is missing, so every card
      carries a real brand mark.

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
