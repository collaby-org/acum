# Tech stack

Pinned versions. These are the versions in `package.json` today — match
these, not "latest", when writing code here.

## Runtime

| Package | Version | Why |
| ------- | ------- | --- |
| `next` | 16.4.2 | App Router, Turbopack by default, Cache Components |
| `react` | 19.3.0 | Server Components, `useSyncExternalStore` |
| `react-dom` | 19.3.0 | — |
| `typescript` | ^5 | Type check (`npx tsc --noEmit`) |
| `tailwindcss` | ^4 | CSS-first config, `@theme` tokens |
| `@tailwindcss/turbopack` | ^4 | The Turbopack CSS loader |

## UI

| Package | Version | Why |
| ------- | ------- | --- |
| `lucide-react` | latest | The only icon set in the project |
| `canvas-confetti` | 1.9.4 | Celebration particle physics |
| `@radix-ui/react-dialog` | latest | Accessible modal (focus trap, escape, scroll lock) |
| `@radix-ui/react-slot` | latest | `asChild` on the button primitive |
| `class-variance-authority` | latest | Variant recipes for the shadcn-style primitives |
| `clsx` | latest | Conditional class names |
| `tailwind-merge` | latest | Tailwind conflict resolution in `cn` |

## Tooling

- **ESLint 9**, flat config (`eslint.config.mjs`). `next lint` was removed in
  Next.js 16 — the script calls the ESLint CLI directly.
- **Turbopack** is the default for `next dev` and `next build`. The
  `turbopack.rules` entry in `next.config.ts` wires the Tailwind CSS loader.
- **Cache Components** (`cacheComponents: true`) and **Partial Prefetching**
  (`partialPrefetching: true`) are on. With Cache Components, anything
  non-deterministic during prerender (for example `new Date()`) must be
  either cached with `"use cache"` or moved to the client.
- **Node.js 20.9+** is the floor.

## Data pipeline

Plain Node scripts, no dependencies, run from the repository root:

| Script | Reads | Writes |
| ------ | ----- | ------ |
| `scripts/scrape-channels.mjs` | `https://www.cool-etv.net/` | `data/channels.raw.json` |
| `scripts/check-embeds.mjs` | `data/channels.raw.json` + the embed hosts | `data/embed-health.json` |
| `scripts/build-dataset.mjs` | all three inputs | `src/data/channels.ts`, `public/logos/` |
| `scripts/fetch-fonts.mjs` | Google Fonts | `public/fonts/` |

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
