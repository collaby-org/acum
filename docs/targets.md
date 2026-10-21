# Targets

What VIZOR is, what it is not, and how success is measured.

## The one-line promise

**Every Romanian TV channel in one place — no account, no ads, no friction.**

## Primary audience

Romanian speakers who want to watch live TV on a laptop or phone, and who
are tired of portals that demand a login before showing a single frame.

## In scope

- A complete, searchable catalogue of the public live TV feeds published on
  `https://www.cool-etv.net/`.
- A player that starts in one click.
- Favourites that work without an account and without a server.
- An honest, per-channel status so nobody wonders why a channel is silent.
- Romanian-language interface with correct diacritics.

## Out of scope

- Accounts, authentication, profiles, cloud sync.
- A backend, a database, a recommendation engine.
- Our own advertising, analytics or tracking of any kind.
- Re-hosting, transcoding or caching the upstream streams.
- A catalogue of sources other than `cool-etv.net` in v1.

## Quality bar

| Dimension | Target | How it is measured |
| --------- | ------ | ------------------ |
| Time to first frame | < 1.5 s on a warm cache | Lighthouse, desktop and mobile |
| Lighthouse (performance) | ≥ 90 | Lighthouse CI on the static build |
| Lighthouse (accessibility) | ≥ 95 | Lighthouse CI on the static build |
| Layout shift | < 0.05 | Lighthouse |
| Catalogue coverage | 100 % of the source menu | `scripts/scrape-channels.mjs` reports family and feed counts |
| Freshness | At most 30 days between catalogue refreshes | `data/channels.raw.json` `generatedAt` |
| Build health | lint, type check and build green | CI on every push and pull request |
| Third-party requests from our origin | 0 | Browser network panel |

## Definition of done for a change

A change is done when:

1. `npm run lint`, `npx tsc --noEmit` and `npm run build` all pass.
2. The behaviour is visible in a real browser at mobile and desktop widths.
3. The living docs in `docs/` and the changelog entry match the code.
4. The version line moved with the change, in the same commit.

## Known constraints

- **Upstream hosts are unreliable.** 87 of 105 unique embed URLs sit behind a
  Cloudflare wall that refuses datacenter networks. VIZOR records that
  honestly instead of hiding it, and the catalogue keeps every channel
  listed.
- **AceStream has no web player.** 23 channels use a desktop protocol
  handler. They stay in the catalogue, labelled.
- **The catalogue is a snapshot.** It is a generated file, refreshed by
  running the pipeline, not a live feed.
