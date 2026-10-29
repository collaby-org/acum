# ACUM TV

The television build of ACUM — the same catalogue, the same player, the same
programme guide, wrapped in an interface you steer with a remote.

A TV has no mouse and no keyboard. Everything here is reached with the
D-pad: focus is a first-class citizen, and every affordance survives being
driven from five buttons. Signing in is done from the phone you already
have — the app shows a QR code, you scan it, and your session crosses over
to the screen. No typing credentials on a television, ever.

The design system for this build is documented in
[`design-system/`](design-system/DESIGN_SYSTEM.md), and the AI-facing registry
in [`design-system/ai/registry.md`](design-system/ai/registry.md).

This app was cut down from [`../frontend`](../frontend) and shares its
catalogue, its data pipeline and its Supabase project. It is deliberately
_not_ a fork: it is the same product for a different input device.

## Status

The ten-foot layer has landed. The build passes, the routes a TV never shows
have been removed, and the app now has the two things a television is actually
about:

- **a design system for three metres** — a type scale that starts where the
  web's ends, a focus ring that is a bar of gold with a bloom, safe-area
  inset, and the cursor rule: the cursor is absent until a pointer moves;
- **a D-pad engine** — one `keydown` listener that moves *real* DOM focus
  geometrically between `[data-tv-nav]` scopes, with rails that wrap and
  remember where you were.

`/tv` is the front door: a hero banner over a row per category, all of it
reachable with four arrows and a select button. What is still to come is the
player's own full-screen chrome and the QR sign-in from the phone, so today a
channel opens its page rather than a player, and the catalogue is visible
before signing in.

## Running it

```bash
npm ci
npm run dev
```

Environment variables are the same ones the frontend uses; see
[`.env.example`](.env.example). Copy it to `.env` and fill in the Supabase
project before signing in — without a session the catalogue stays behind
the paywall.

| script               | what it does                            |
| -------------------- | --------------------------------------- |
| `npm run dev`        | dev server on http://localhost:3000     |
| `npm run build`      | production build                        |
| `npm run start`      | serve the production build              |
| `npm run lint`       | eslint                                  |
| `npm run typecheck`  | `next typegen` + `tsc --noEmit`         |

## What this app does not have

`/admin`, the legal pages, the contact form, the "propose a channel" form,
the FAQ and the about page are web surfaces. They were deleted rather than
hidden — a TV that renders a contact form only wastes a render. If one is
ever needed back on TV, it belongs to the phone, not here.

## Deploying it

A separate Vercel project, not a rewrite or a route on the frontend one:

- **Root directory:** `monorepo/tv`
- **Framework preset:** Next.js
- Node 22 or later (`@supabase/supabase-js` warns below that)
- The same `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
  `NEXT_PUBLIC_SITE_URL` as the frontend; set them before the build, since
  `NEXT_PUBLIC_*` values are inlined at build time

Keeping two projects is deliberate: a TV bundle is a different bundle, and a
television should be able to take a release without taking one on with the
phone. CI lives in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
