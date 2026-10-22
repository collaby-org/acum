# The desk

The desk is ACUM's own control room: who is watching, what they paid for, what
the catalogue holds and what people wrote to us. It is not a separate app and
it has no separate password — it is an ordinary account that carries a mark.

Everything under `/admin` is a **server** route: the page decides whether to
render at all, and every `/api/admin` route checks the same guard before it
reads a row. Hiding a menu is not a lock; the lock is `deskState()` in
`src/lib/admin.ts`.

## Who gets in

An account carries the desk mark in one of three ways:

| Mark | How | Where it is set |
| --- | --- | --- |
| E-mail | listed in `ADMIN_EMAILS` (comma or space separated) | environment (local `.env`, Vercel project settings) |
| Plan | `plan = 'comp'` | `/admin/conturi`, or SQL |
| Bypass | `bypass = true` | `/admin/conturi`, or SQL |

The owner's account is `gmgmethereum@gmail.com`; locally `.env` carries it in
`ADMIN_EMAILS`, and Vercel needs the same variable in **Settings → Environment
Variables** (all environments) before the desk opens there.

Everyone else — a visitor, a signed-in free account, a paying account — gets
the ordinary 404 page. The refusal is a 404 rather than a 403 on purpose: a
desk that announces itself to strangers is a map for them.

## How to open it

1. Sign in at `/conturi` with the account that carries the mark.
2. The app bar shows a **Panou** door once the account has the mark. Choose it,
   or go straight to `/admin`.

The gate runs on the server, and the server cannot read `localStorage` — so
the access token is mirrored into the `acum-session` cookie on every account
refresh and cleared on sign-out. That cookie is what `deskState()` reads,
after it has verified the token against the auth server. Nothing in the cookie
is believed on its own.

### The one thing that must be set

`SUPABASE_SERVICE_ROLE_KEY`. The policies in `supabase/schema.sql` give the
accounts, the messages and the statistics to nobody — which is the point — so
the desk reads them with the service role, on the server, and never sends that
key to a browser. Without it the desk renders a card that says exactly that
(«Cheia de service role lipsește»), and `/api/admin/*` answers `503`.

Set it in `.env` locally and in Vercel's environment for the deployment. It is
a secret: it stays out of the repository, out of the client bundle and out of
every log.

## The pages

### `/admin` — the overview

- The live audience as it is counted at the proxy: how many browsers are
  watching *right now*, and the busiest channels.
- The numbers of the Romanian day: accounts, sign-ins, minutes watched,
  paywalls met, conversions.
- The last thirty days, rolled up; the rollup never lowers a number.
- The plans, and how many accounts sit on each.
- The catalogue at a glance: channels, feeds, how many can play, how many have
  a spare feed, the quality and status split.
- The newest accounts.

### `/admin/conturi` — the accounts

Search by e-mail or name, filter by plan, and read the day's minutes per
account. From a row the desk can grant:

- a plan (`free`, `monthly`, `household`, `lifetime`, `comp`),
- an end date (a monthly grant defaults to thirty days; `lifetime` and `comp`
  never end),
- `bypass`, which lifts the paywall for that account,
- a note saying why.

Each grant appends one line to the account's audit trail: when, from which
plan to which, until when, whether bypass was set, who did it and why. The
last twelve lines are kept.

### `/admin/catalog` — the catalogue

The same public view a visitor gets — names, artwork, status, quality, feeds
counted in total — plus the breakdowns. It deliberately does not show upstream
addresses, source pages or how many feeds one channel has: the desk reads the
catalogue, it does not leak it.

### `/admin/mesaje` — the messages

What the contact form wrote: inbox, unread, archived. A message can be marked
read or archived; nothing is deleted from here.

## The routes behind the pages

| Route | Methods | What it serves |
| --- | --- | --- |
| `/api/admin/overview` | `GET` | the overview payload |
| `/api/admin/accounts` | `GET` | the account list (`q`, `plan`, `limit`) |
| `/api/admin/accounts/grant` | `POST` | a plan/bypass grant with its audit line |
| `/api/admin/catalogue` | `GET` | the catalogue rows and summary |
| `/api/admin/messages` | `GET` | the message list (`state`) |
| `/api/admin/messages/:id` | `POST` | `{ read?, archived? }` |

All of them accept the session as a bearer token and verify it before reading
anything; a refusal is `401` (not signed in), `403` (no mark) or `503` (no
service role key), never an empty list that looks like a quiet day.

## Checking it by hand

```bash
# signed out — the desk does not exist
curl -i http://127.0.0.1:3115/admin          # 404 page

# the guard behind the API
curl -i http://127.0.0.1:3115/api/admin/overview            # 401
curl -i -H "Authorization: Bearer <access token>" \
     http://127.0.0.1:3115/api/admin/overview               # 200 for a marked account
```

A real session can be minted from the harness account with the password grant,
which is how the gate is tested without a browser; see
`scripts/harness-signin.mjs`.

## What the desk cannot do

- It cannot delete an account: accounts belong to the auth service.
- It cannot edit a message, only read or archive it.
- It cannot see upstream addresses, tokens or the service role key.
- It cannot open without `SUPABASE_SERVICE_ROLE_KEY`.
- It cannot be reached from a browser that is not signed in with a marked
  account, whatever the URL says.
