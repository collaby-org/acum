# Spec — the player

Status: accepted · Version line: `package.json` · Owner: integrator

## The problem

The first version embedded the upstream player page directly:

```tsx
<iframe src="https://canale-tv.net/channel-v2/a1.html" />
```

That worked, and it broke three things.

1. **Ads.** The upstream page loads `acscdn.com/script/aclib.js` and calls
   `aclib.runPop({ zoneId: '10894994' })`, which opens an ad in a **new
   window**. It also loads `adexchangerapid.com`, `usrpubtrk.com` and Google
   Analytics. The app promised no ads; the embed broke the promise.
2. **Two clicks.** The upstream shows a poster. Clicking the channel card
   opened the player; the visitor then had to click the poster before
   anything played. Netflix is one click.
3. **No control, no fallback.** The upstream chrome looked nothing like the
   app, and there was nowhere to go when a feed was down.

## The finding that decides everything

**The upstream hosts are behind a Cloudflare Referer allowlist.**

Probed with a full cross-site iframe header set, the panel hosts behave like
this:

| Request | Result |
| ------- | ------ |
| `Referer: https://www.cool-etv.net/` | **200**, a real player panel |
| `Referer: https://www.cool-etv.net/ch/<slug>.htm` | 200 |
| `Referer: <the panel host's own origin>` | 200 |
| any other referer — none, our origin, `example.com`, `localhost`, plain `http`, a lookalike host | **301 → `https://www.google.com/`** |

The same gate applies to the HLS playlist, the variant playlist and the
segments: the m3u8 host serves a real `#EXTM3U` only when the referer is
either its own origin or `https://www.cool-etv.net/`. Otherwise it serves an
HTML cloaking page.

Three consequences:

- The first version's catalogue was wrong. 84 embeds serve a real player, not
  15; 13 are genuinely broken. The probe misclassified them because the
  panel HTML contains no `<video>`, no `hls.js` and no `.m3u8` — only
  `alpha.js`, `omega1.js` and `var suki='<channel>.jpg'`.
- A browser cannot set a `Referer`. **The stream has to be proxied.**
- The only arrangement that hands a panel the right referer is the
  cool-etv.net channel page, which embeds the panel itself.

The m3u8 token is **deterministic per channel** — the same value across
independent browser launches — so it can be resolved once at build time.

## The decision

Three paths, chosen per server, in this order.

### Path A — direct HLS (preferred)

`Server.hlsUrl` holds a resolved HLS playlist. The app plays it with its own
`hls.js` instance and its own controls.

`GET /api/stream?t=<signed token>`

- takes **only** an opaque token minted by `/api/player` for an account that
  passed the gate; there is no form in which the browser names an upstream
  address;
- fetches server-side, spoofing a referer: the target URL's own origin
  first, `https://www.cool-etv.net/` as the fallback;
- rewrites every URI in an HLS playlist back through `/api/stream` — as a
  fresh signed token, never as a plain address — so the whole segment chain
  keeps the referer;
- refuses any host outside the exact upstream allowlist (SSRF guard): the
  hosts in `data/canale-tv-streams.json`, `data/resolved-streams.json`,
  `data/embed-health.json` and `src/data/channels.ts`, compared whole. Shared
  suffixes such as `.cfd` or `.shop` are not accepted;
- follows redirects by hand, at most three hops, checking every hop again —
  including the resolved address, which must not be private, loopback or
  link-local;
- never caches — playlists are tokenised and short-lived, and every response
  that carries a token is `no-store`.

The playlist URL is discovered by `scripts/resolve-streams.mjs`, which drives
headless Edge over the DevTools protocol, loads the panel with the cool-etv
referer, clicks the poster and reads the captured `.m3u8` request. The
result is committed as `data/resolved-streams.json` and folded into the
catalogue.

### Path B — the upstream panel, read by the server (fallback)

For a feed with no resolved HLS URL, the **server** reads the upstream panel
to find one. The browser never names the address: it names a channel id, and
the catalogue holds the addresses.

`POST /api/player { channel }`

- the account is authenticated and passed through the paywall gate before
  anything is resolved;
- the feeds of that channel come from the catalogue, not from the caller —
  the branch that accepted a `servers[]` list from the browser is deleted;
- the server probes the panel (a page on `canale-tv.net`, `canale-tv.com` or
  a host in the allowlist) for the playlist it hides, strips every ad and
  tracker from what it reads — scripts on `acscdn.com`,
  `adexchangerapid.com`, `usrpubtrk.com` and `googletagmanager.com`, and any
  inline `aclib.runPop`, `gtag(` or `dataLayer` call — and answers with a
  signed manifest;
- the response is `no-store`.

The earlier form, `GET /api/player?u=<absolute url>`, is gone: a browser that
can name an address can point the server anywhere.

### Path C — the cool-etv channel page (last resort)

A panel feed cannot be embedded directly from our origin — it would get the
301 to Google. It can be embedded as
`https://www.cool-etv.net/ch/<slug>.htm`, because that page embeds the
panel and the panel then sees the referer it requires. The frame is
sandboxed without `allow-popups`, so no ad window can open.

The trade-off is explicit: the visitor has to click the panel's own poster
inside the frame, because our page cannot auto-click across an origin
boundary. The UI says so.

## The player

One component, one click to play. The parent hands it a `Channel`; it picks
the best server and starts immediately.

- `hls.js` for HLS, native `<video>`; Safari plays HLS natively.
- Own controls, **in one bar inside the frame**: play/pause, a breathing live
  indicator, a live-edge-locked scrubber (a TV app does not let you scrub into
  the past), volume and mute, fullscreen, Picture-in-Picture where supported.
  The bar reveals itself on hover on a desktop and hides after three seconds;
  on a phone one tap reveals it and it hides after four seconds, and that tap
  never toggles the video by accident.
- **Fallback is automatic**: a playback error or a stall advances to the next
  server in `channel.servers`, and the UI says so ("Server 2/3").
- Escape closes, the backdrop closes, focus is trapped and restored, body
  scroll locks.

## The security boundary

The proxy is the one place in the app that talks to the upstream, so it is
also the one place that has to be strict.

- **The token is the only key.** `/api/stream` takes `?t=` and nothing else.
  The token carries the upstream address, the channel, the viewer and an
  expiry; it is signed with a key that lives in the environment — or is
  derived from the Supabase service key — and never in the source.
- **The gate is in front of the manifest.** `/api/player` authenticates the
  account, reads its state with the service role, and only then resolves a
  feed. A visitor whose allowance is spent gets no address at all.
- **The allowlist is exact.** Whole hosts from the repository's own
  inventories, never suffixes, never addresses from the caller.
- **The viewer is not a parameter.** The audience count comes from the signed
  payload, so it cannot be forged by a query string.
- **Nothing that carries a token is cached.**

## The cost, stated plainly

The proxy streams video bytes through the server. That is the price of an
own player with no ad scripts, and it is not free at scale. The alternative
— a sandboxed upstream frame — is nearly free but inherits the upstream's
chrome, its poster click and, on the panel hosts, its own ad scripts.

Path A is the default. Path C exists so that a channel whose playlist
cannot be resolved still plays something.

## What this buys

- No ad window, on any path.
- One click, not two, for every channel with a resolved playlist.
- Our own chrome and our own controls.
- A second chance when a feed is down.
- A catalogue that is honest: 167 of 203 channels playable, 23 AceStream
  (no web player exists), 13 genuinely dead.
