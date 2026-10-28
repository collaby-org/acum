# ACUM TV

The television build of ACUM — the same catalogue, the same player, the same
programme guide, wrapped in an interface you steer with a remote.

A TV has no mouse and no keyboard. Everything here is reached with the
D-pad: focus is a first-class citizen, and every affordance survives being
driven from five buttons. Signing in is done from the phone you already
have — the app shows a QR code, you scan it, and your session crosses over
to the screen. No typing credentials on a television, ever.

This app was cut down from [`../frontend`](../frontend) and shares its
catalogue, its data pipeline and its Supabase project. It is deliberately
_not_ a fork: it is the same product for a different input device.

## Status

Skeleton. The build passes and the routes that a TV never shows have been
removed, but the TV components, the focus system and the QR sign-in flow
are still to be written. Until they land this is the web app wearing the
routes of a TV app.

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
