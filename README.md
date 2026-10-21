# VIZOR

**TV live românesc, fără reclame și fără cont.**

A Netflix-style directory of every Romanian live TV channel, built from the
public embed addresses published on
[cool-etv.net](https://www.cool-etv.net/).

![Next.js](https://img.shields.io/badge/Next.js-16.4.2-000?logo=next.js) ![React](https://img.shields.io/badge/React-19.3-087ea4?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript) ![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss) ![License](https://img.shields.io/badge/license-MIT-10b981)

---

## What it is

- **203 channels**, 74 families, 7 categories — the complete menu of the
  source site, corrected and reorganised.
- **One click to play.** The upstream player opens in a modal, in an iframe,
  exactly as the source site ships it.
- **No account.** Favourites live in your browser.
- **No ads of ours.** No analytics, no trackers, no consent banner. The
  third-party players you land in are outside our control — we say so in the
  interface instead of pretending otherwise.
- **Honest status.** Every channel is probed; the app tells you which ones
  actually serve a stream and which ones the upstream host is refusing.

## Screens

| | |
| - | - |
| **Hero** — a featured live channel, typographic, with a floating screen mock. | **Rails** — one horizontal rail per category, live channels first. |
| **Search** — instant, diacritic-insensitive, `⌘K` to focus. | **Player** — modal, sandboxed iframe, copy-link and source actions. |

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

Requires Node.js 20.9 or newer.

```bash
npm run lint        # ESLint (flat config)
npx tsc --noEmit    # type check
npm run build       # Turbopack production build
```

## How the catalogue is built

The channel list is generated, not hand-written. The pipeline lives in
`scripts/` and uses only Node built-ins:

```bash
node scripts/scrape-channels.mjs   # cool-etv.net  -> data/channels.raw.json
node scripts/check-embeds.mjs      # liveness probe -> data/embed-health.json
node scripts/build-dataset.mjs      # merge + logos  -> src/data/channels.ts
```

`scripts/channel-taxonomy.json` is the editorial layer: the source obfuscates
its labels (`HB0 R0` is HBO, `Ant 1` is Antena 1, `L00K Tv` is LOOK TV), so
every family and feed gets a corrected Romanian display name and a category.

`src/data/channels.ts` is generated — do not edit it by hand.

## Statuses

| Status | Meaning |
| ------ | ------- |
| **Live** | The embed was verified serving a video player. |
| **Indisponibil** | The upstream host refused the request. May still work from a home connection. |
| **Fără răspuns** | The upstream host did not answer. |
| **Necesită plugin** | AceStream protocol — no browser player exists. |
| **Fără sursă** | The source page ships no embeddable player. |

At release: 19 channels verified playable, 157 behind a bot wall, 23
AceStream-only.

## Project layout

```
scripts/           build-time pipeline (no dependencies)
data/              committed snapshots of the scrape and the probe
src/app/           routes, layout, design tokens
src/components/    the UI
src/components/ui/ shadcn-style primitives
src/data/          the generated catalogue
src/lib/           status metadata, palette, particle system
src/hooks/         localStorage favourites
public/logos/      194 channel logos
public/fonts/      self-hosted Space Grotesk + Inter
design-system/     tokens, components, motion rules
docs/              living docs
```

## Documentation

- [docs/project-doc.md](docs/project-doc.md) — what the project is and how it
  is built
- [docs/system_diagram.md](docs/system_diagram.md) — architecture
- [docs/tech_stack.md](docs/tech_stack.md) — pinned versions
- [docs/targets.md](docs/targets.md) — scope and quality bar
- [docs/roadmap.md](docs/roadmap.md) — what is next
- [docs/changelog.md](docs/changelog.md) — release history
- [design-system/DESIGN_SYSTEM.md](design-system/DESIGN_SYSTEM.md) — tokens,
  components, motion rules
- [AGENTS.md](AGENTS.md) — the contract for agents and contributors
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Every change lands through a pull
request, and the template asks for evidence and a `version: before → after`.

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities privately through
GitHub's security advisory form.

## Licence

MIT — see [LICENSE](LICENSE).

The channels themselves belong to their respective owners. VIZOR indexes the
public embed addresses published by the source site and links back to it.
