# Tech stack

Pinned versions. These are the versions actually installed in
`monorepo/frontend` and `monorepo/tv` today — match these, not "latest",
when writing code here.

## Layout

| Folder | What it is | Version line |
| ------ | ---------- | ------------ |
| `monorepo/frontend/` | The web app: desktop, mobile and the installed PWA. | `monorepo/frontend/package.json` |
| `monorepo/tv/` | The television app: remote-driven, ten-foot, deployed on its own. | `monorepo/tv/package.json` |
| `supabase/` | The database of record: `schema.sql` and the migrations. | — |
| `docs/` | The living documentation: changelog, this file, the scope. | `docs/VERSION` |

The two apps share the catalogue, the badge vocabulary, the review engine
and the schema — not a copy of the source. `monorepo/tv/src` is a
projection of `monorepo/frontend/src` with the television's own layer
(`src/components/tv/**`, `src/hooks/use-remote-*.ts`) on top; the
television-only files are never overwritten by a sync.

## Runtime

| Package | Version | Why |
| ------- | ------- | --- |
| `next` | 16.4.2 | App Router, Turbopack by default, Cache Components |
| `react` | 19.3.0 | Server Components, `useSyncExternalStore` |
| `react-dom` | 19.3.0 | — |
| `typescript` | 5.9.3 | Type check (`node node_modules/typescript/bin/tsc --noEmit`) |
| `tailwindcss` | 4.3.4 | CSS-first config, `@theme` tokens |
| `@tailwindcss/turbopack` | ^4 | The Turbopack CSS loader |

The television app runs the same versions: Next 16.4.2, React 19.3.0,
TypeScript 5.9.3, Tailwind 4.3.3 — its own installed copy, one patch
behind the web app.

## UI

| Package | Version | Why |
| ------- | ------- | --- |
| `lucide-react` | 1.67.0 | The only icon set in the project |
| `canvas-confetti` | 1.9.4 | Celebration particle physics |
| `@radix-ui/react-dialog` | ^1.3.1 | Accessible modal (focus trap, escape, scroll lock) |
| `@radix-ui/react-slot` | ^1.5.0 | `asChild` on the button primitive |
| `class-variance-authority` | ^0.7.1 | Variant recipes for the shadcn-style primitives |
| `clsx` | ^2.1.1 | Conditional class names |
| `tailwind-merge` | ^3.7.0 | Tailwind conflict resolution in `cn` |

## Playback and data

| Package | Version | Why |
| ------- | ------- | --- |
| `hls.js` | 1.7.4 | The HLS engine for the live streams |
| `@supabase/supabase-js` | ^2.118.0 | Accounts, plans, favourites and reviews |

- The browser never sees an upstream address: every stream is resolved and
  proxied by `/api/stream`, and the proxy only opens a **signed** token —
  the raw address doors are gone.
- The review counters are **server truth**: the `review_reaction_counts`
  function in `supabase/schema.sql` publishes the counts, and the client
  reconciles against it after a write.

## Environment

| Variable | Where | What it is |
| -------- | ----- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | both apps | the project's address and its publishable key — public by design, they reach the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | the service-role key; it never leaves the server |
| `STREAM_TOKEN_SECRET` | server only, optional | the key the stream proxy signs its tokens with. When it is absent the proxy **derives** a per-deployment key from `SUPABASE_SERVICE_ROLE_KEY`, so no new variable is needed to run the app |
| `ADMIN_EMAILS` | server only, optional | comma-separated e-mails allowed to open the desk (`/admin`, `/api/admin/*`) |
| `ACUM_DEVICE_SALT` | server only, optional | the salt of the household device fingerprint |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | server only | the payments |
| `ACUM_HARNESS_EMAIL`, `ACUM_HARNESS_PASSWORD` | local only | the account the verification harnesses sign in with; never on the server |

None of the server-only values is ever committed. The secret scan in
`.github/workflows/secret-scan.yml` runs on every pull request and on
every push to `main`.

## Tooling

- **ESLint 9** (9.39.5), flat config (`eslint.config.mjs`). `next lint` was
  removed in Next.js 16 — the script calls the ESLint CLI directly.
- **Turbopack** is the default for `next dev` and `next build`. The
  `turbopack.rules` entry in `next.config.ts` wires the Tailwind CSS loader.
- **Cache Components** (`cacheComponents: true`) and **Partial Prefetching**
  (`partialPrefetching: true`) are on. With Cache Components, anything
  non-deterministic during prerender (for example `new Date()`) must be
  either cached with `"use cache"` or moved to the client.
- **Node.js 20.9+** is the floor. CI runs Node 22; the local machine runs
  Node 24.
- `npx` is unreliable in this repository: call the binaries directly —
  `node node_modules/typescript/bin/tsc --noEmit`,
  `node node_modules/eslint/bin/eslint.js <paths>`,
  `node_modules\.bin\next.cmd build`.

## Data pipeline

Plain Node scripts with no dependencies of their own, run from
`monorepo/frontend/`:

| Script | npm script | Reads | Writes |
| ------ | ---------- | ----- | ------ |
| `scripts/scrape-channels.mjs` | `npm run data:scrape` | `https://www.cool-etv.net/` | `data/channels.raw.json` |
| `scripts/check-embeds.mjs` | `npm run data:probe` | `data/channels.raw.json` + the embed hosts | `data/embed-health.json` |
| `scripts/resolve-streams.mjs` | `npm run data:resolve` | the raw catalogue + the sources | the resolved stream addresses |
| `scripts/build-dataset.mjs` | `npm run data:build` | all of the above | `src/data/channels.ts`, `public/logos/` |
| `scripts/scrape-epg.mjs` | `npm run data:epg` | `https://canaletvlive.online` | `data/epg.json` — the programme guide |
| `scripts/scrape-secondary.mjs` | — | the second source's directory | `data/secondary-sources.json` |
| `scripts/capture-posters.mjs` | `npm run data:stills` | the live streams | the card artwork |

**The guide is refreshed by the clock, not by a human.**
`.github/workflows/refresh-epg.yml` runs `scrape-epg.mjs` twice a day and
commits `data/epg.json` only when it changed. A stale guide is a broken
product: the "Acum" surfaces resolve against the real clock, so a guide
that has expired empties every one of them.

## Progressive web app

- `public/manifest.webmanifest` — the install contract: `start_url` `/`,
  maskable icons, and shortcuts to the catalogue and to search.
- `public/sw.js` — a hand-written service worker: the shell and the pages
  are cached, the hashed assets are evicted on every activation, and every
  stale cache is dropped when a new version takes over.
- `src/components/pwa/**` — the registration, the install offer, the
  update toast and the offline badge. The install offer belongs to the
  phone; where the browser fires `beforeinstallprompt` that is the path,
  and the share-sheet recipe is the fallback.

## TypeScript

- `strict: true`.
- Import alias `@/*` → `src/*`.
- `Channel`, `Category`, `CategoryId` and `ChannelStatus` are generated into
  `src/data/channels.ts`. Import from there, never redeclare them.

## Design system

See `design-system/DESIGN_SYSTEM.md` for tokens, components and motion rules.
Tokens live in `src/app/globals.css` under `@theme`.

## Browser support

Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+ (the Next.js 16 floor).
