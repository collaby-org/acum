/**
 * Resolve a direct HLS playlist for upstream player pages.
 *
 * Some upstreams ship a player *page* instead of a media URL: the page hides
 * a "click to play" poster, and when you press it the page computes an
 * absolute HLS URL on a different host (Referer-gated). Pointing an iframe at
 * such a page works, but it drags the upstream chrome along. This script
 * drives headless Edge over the DevTools protocol, presses the play button and
 * reads the `.m3u8` request the page's own script makes — so the app can play
 * the stream directly.
 *
 *   node scripts/resolve-streams.mjs --help
 *   node scripts/resolve-streams.mjs an1 an1-s2
 *
 * Writes data/resolved-streams.json:
 *   { "<slug>": { "hlsUrl": "…", "playerPage": "…", "embedUrl": "…" } }
 *
 * Node built-ins only. Needs Node 22+ (global WebSocket) and Edge/Chrome.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const EDGE_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

const PLAYER_HOSTS = /(^|\.)(canale-tv\.net|canale-tv\.com)$/i;
const PLAYER_URL_SHAPES = [
  (slug) => `https://canale-tv.net/channel-v2/${slug}.html`,
  (slug) => `https://canale-tv.net/channel/${slug}.html`,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEBUG = Boolean(process.env.RESOLVE_DEBUG);

const USAGE = `
Usage: node scripts/resolve-streams.mjs [options] [slug ...]

  Resolves the direct HLS playlist behind an upstream player page by driving
  headless Edge over the DevTools protocol.

Arguments:
  slug ...        Feed slugs to resolve (e.g. an1, an1-s2, protv-s3).
                  Without arguments every feed that ships an iframe embed in
                  data/channels.raw.json is resolved.

Options:
  --out <file>    Output file. Default: data/resolved-streams.json
  --timeout <ms>  Per-page budget. Default: 12000
  --attempts <n>  Attempts per page. Default: 2
  --no-auto       Do not add the embeds from the scrape
  --slugs         Print the slugs that carry an embed and exit
  --help          Show this message
`.trim();

/* ------------------------------------------------------------------ *
 * Arguments
 * ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
let outFile = resolve(ROOT, "data/resolved-streams.json");
let timeoutMs = 12000;
let attempts = 2;
let auto = true;
let listOnly = false;
const requested = [];

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--help" || arg === "-h") {
    console.log(USAGE);
    process.exit(0);
  } else if (arg === "--out") {
    outFile = resolve(ROOT, argv[++i]);
  } else if (arg === "--timeout") {
    timeoutMs = Number(argv[++i]);
  } else if (arg === "--attempts") {
    attempts = Number(argv[++i]);
  } else if (arg === "--no-auto") {
    auto = false;
  } else if (arg === "--slugs") {
    listOnly = true;
  } else if (arg.startsWith("--")) {
    console.error(`unknown option: ${arg}\n${USAGE}`);
    process.exit(2);
  } else {
    requested.push(arg);
  }
}

/* ------------------------------------------------------------------ *
 * Targets: the feed slugs and the player page each one uses
 * ------------------------------------------------------------------ */
let raw = { channels: [] };
try {
  raw = JSON.parse(await readFile(resolve(ROOT, "data/channels.raw.json"), "utf8"));
} catch {
  console.warn("[resolve] data/channels.raw.json is missing — no embeds to scan");
}

const feeds = raw.channels ?? [];
const bySlug = new Map();
for (const feed of feeds) {
  if (!bySlug.has(feed.slug)) bySlug.set(feed.slug, feed);
}

const isPlayerUrl = (url) => {
  try {
    return PLAYER_HOSTS.test(new URL(url).host);
  } catch {
    return false;
  }
};

/**
 * The panel hosts share one pool of channel pages: every host serves
 * `/000/<file>.html` for a set of channels. A feed whose own panel is dead
 * usually lives on another host of the pool.
 */
const panelPool = [...new Set(
  feeds
    .map((feed) => feed.embedUrl)
    .filter((url) => url && /\/000\/[^/]+\.html$/.test(url))
    .map((url) => new URL(url).host),
)];

/** The same channel page on another host of the pool. */
function poolVariants(url) {
  const match = url.match(/^(https?:\/\/[^/]+)(\/000\/[^/]+\.html)$/);
  if (!match) return [];
  const [, , path] = match;
  return panelPool.filter((host) => host !== new URL(url).host).map((host) => `https://${host}${path}`);
}

/**
 * A cheap check whether a page is a live panel: the upstream panels answer
 * a plain request with their player shell when the Referer is the one the
 * publisher uses.
 */
async function servesPlayer(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        referer: "https://www.cool-etv.net/",
      },
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.text();
    return /alpha\.js|omega1\.js|click-to-play/.test(body);
  } catch {
    return false;
  }
}

const embedOf = (slug) => bySlug.get(slug)?.embedUrl ?? null;

/** The player pages a slug should be driven on, best first. */
function pageCandidates(slug) {
  const embed = embedOf(slug);
  const candidates = [];
  if (!embed) {
    for (const shape of PLAYER_URL_SHAPES) candidates.push(shape(slug));
    return candidates;
  }
  candidates.push(embed);
  if (isPlayerUrl(embed)) {
    // canale-tv.com and canale-tv.net serve the same player; one host is
    // often dead while the other still resolves.
    const mirror = embed.replace("canale-tv.com", "canale-tv.net");
    if (mirror !== embed) candidates.push(mirror);
    for (const shape of PLAYER_URL_SHAPES) {
      const url = shape(slug);
      if (!candidates.includes(url)) candidates.push(url);
    }
  } else {
    // A dead panel may live on another host of the pool; that is handled
    // separately, after the feed's own page has failed.
  }
  return candidates;
}

const targets = new Map(); // slug -> { slug, embedUrl, pages: string[] }

for (const slug of requested) {
  targets.set(slug, {
    slug,
    embedUrl: embedOf(slug),
    pages: pageCandidates(slug),
  });
}

if (auto) {
  for (const feed of feeds) {
    if (!feed.embedUrl) continue;
    const existing = targets.get(feed.slug);
    if (existing) {
      if (!existing.pages.includes(feed.embedUrl)) existing.pages.unshift(feed.embedUrl);
      continue;
    }
    targets.set(feed.slug, {
      slug: feed.slug,
      embedUrl: feed.embedUrl,
      pages: pageCandidates(feed.slug),
    });
  }
}

if (listOnly) {
  for (const slug of [...targets.keys()].sort()) console.log(slug);
  process.exit(0);
}

if (!targets.size) {
  console.log("[resolve] nothing to do — no slugs given and no embeds in the scrape");
  process.exit(0);
}

/* ------------------------------------------------------------------ *
 * DevTools protocol plumbing
 * ------------------------------------------------------------------ */
class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Set();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.addEventListener("open", res, { once: true });
      this.ws.addEventListener("error", rej, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve: res, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || `CDP error ${msg.error.code}`));
        else res(msg.result);
        return;
      }
      if (msg.method) for (const handler of this.handlers) handler(msg);
    });
  }

  /**
   * The upstream tears the page down when it is poked through a pinned
   * execution context, so every evaluation goes to the default context of
   * the target — the document that is actually on screen.
   */
  send(method, params = {}, timeout = 15000) {
    const id = ++this.nextId;
    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        rej(new Error(`CDP timeout: ${method}`));
      }, timeout);
      timer.unref?.();
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          res(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          rej(e);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(handler) {
    this.handlers.add(handler);
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* already gone */
    }
  }
}

/* ------------------------------------------------------------------ *
 * Headless Edge
 * ------------------------------------------------------------------ */
const EDGE = EDGE_CANDIDATES.find((p) => existsSync(p));
if (!EDGE) {
  console.error("[resolve] no Edge/Chrome binary found");
  process.exit(1);
}

/**
 * A free debugging port. Reusing a fixed one is a trap: an Edge left over
 * from an earlier run keeps the port, and this script would then drive that
 * stale browser instead of its own.
 */
const freePort = async (preferred) => {
  for (let port = preferred; port < preferred + 200; port++) {
    const free = await new Promise((res) => {
      const probe = createServer();
      probe.once("error", () => res(false));
      probe.listen(port, "127.0.0.1", () => probe.close(() => res(true)));
    });
    if (free) return port;
  }
  throw new Error("no free debugging port");
};

const PORT = await freePort(Number(process.env.RESOLVE_STREAMS_PORT || 9351));
// A profile of its own, kept between runs: the panel scripts are then
// cached, the player is built within a fraction of a second, and the page
// survives long enough to hand out its playlist.
const PROFILE = resolve(tmpdir(), "vizor-resolve-streams-profile");

const edge = spawn(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--autoplay-policy=no-user-gesture-required",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

let edgeReady = false;
for (let i = 0; i < 60 && !edgeReady; i++) {
  await sleep(500);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (res.ok) edgeReady = true;
  } catch {
    /* not up yet */
  }
}
if (!edgeReady) {
  edge.kill();
  console.error("[resolve] Edge did not open its debugging port");
  process.exit(1);
}
console.log(`[resolve] edge ready on port ${PORT}`);

/** Edge leaves child processes behind; take the whole tree down. */
const killEdge = () => {
  try {
    spawn("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" });
  } catch {
    edge.kill();
  }
};
const devtools = async (path, init) => {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, init);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
};

/* ------------------------------------------------------------------ *
 * One page
 * ------------------------------------------------------------------ */
const STATE_EXPR = `(() => {
  const el = document.querySelector('#click-to-play');
  const warn = document.querySelector('#warning-message');
  const video = document.querySelector('video');
  return {
    href: location.href,
    poster: el ? getComputedStyle(el).display : null,
    rect: el ? (() => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })() : null,
    warn: warn ? (warn.textContent || '').trim().slice(0, 120) : null,
    video: video ? video.src : null,
    body: document.body ? document.body.innerHTML.length : -1,
    head: document.documentElement ? document.documentElement.outerHTML.slice(0, 120) : '',
  };
})()`;

async function evaluate(session, expression) {
  const result = await session.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluate failed");
  return result?.result?.value;
}

async function attempt(url, budgetMs) {
  // The target starts on about:blank so that the network recorder is armed
  // before the upstream page starts loading.
  const target = await devtools("/json/new?about:blank", { method: "PUT" });
  const session = new CdpSession(target.webSocketDebuggerUrl);
  const m3u8 = [];
  const deadline = Date.now() + budgetMs;

  try {
    await session.connect();
    session.on((msg) => {
      if (msg.method !== "Network.requestWillBeSent") return;
      const requestUrl = msg.params?.request?.url;
      if (DEBUG) console.log("      req", requestUrl.slice(0, 120));
      if (requestUrl && /\.m3u8(?:$|\?)/i.test(requestUrl)) m3u8.push(requestUrl);
    });

    await session.send("Page.enable");
    await session.send("Runtime.enable");
    await session.send("Network.enable");
    // The upstream refuses to build a playlist for a request without a
    // Referer — it wants to look like an embed.
    await session.send("Network.setExtraHTTPHeaders", {
      headers: { Referer: "https://www.cool-etv.net/" },
    });
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await session.send("Page.navigate", { url });

    let clicks = 0;
    let lastClick = 0;
    while (Date.now() < deadline) {
      if (m3u8.length) break;
      await sleep(120);
      let state = null;
      try {
        // No explicit context: the upstream tears the page down when it is
        // poked through a pinned execution context.
        state = await evaluate(session, STATE_EXPR);
      } catch {
        /* the document is swapping */
        continue;
      }
      if (!state) continue;
      if (DEBUG)
        console.log(
          "      state",
          JSON.stringify({ href: state.href, poster: state.poster, warn: state.warn, video: state.video }),
        );
      // The panel pages hand the playlist straight to the video element.
      if (state.video && /\.m3u8(?:$|\?)/i.test(state.video)) {
        m3u8.push(state.video);
        break;
      }
      // The channel pages hide the playlist behind a poster. The press has to
      // happen early: the upstream gives up on the page a moment later.
      if (state.poster !== null && Date.now() - lastClick > 1500) {
        if (state.rect && state.rect.w > 0) {
          // A trusted gesture on the visible poster.
          const point = {
            x: Math.round(state.rect.x),
            y: Math.round(state.rect.y),
            button: "left",
            clickCount: 1,
          };
          await session.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point }).catch(() => {});
          await session.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point }).catch(() => {});
          await session.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point }).catch(() => {});
        } else {
          await evaluate(
            session,
            `(() => { const el = document.querySelector('#click-to-play'); if (!el) return 'gone'; el.click(); return 'ok'; })()`,
          ).catch(() => {});
        }
        clicks++;
        lastClick = Date.now();
        if (clicks >= 4) break;
      }
    }

    if (!m3u8.length) {
      let hint = clicks
        ? "the poster was pressed but no .m3u8 request went out"
        : "no playlist appeared";
      try {
        const after = await evaluate(session, STATE_EXPR);
        if (after?.warn) hint = `upstream said: ${after.warn}`;
      } catch {
        /* page gone */
      }
      return { hlsUrl: null, reason: hint };
    }
    return { hlsUrl: m3u8[0], reason: null };
  } finally {
    session.close();
    try {
      await devtools(`/json/close/${target.id}`);
    } catch {
      /* the browser already dropped it */
    }
  }
}

async function resolvePage(url, budgetMs = timeoutMs, tries = attempts) {
  let last = "not attempted";
  for (let i = 0; i < tries; i++) {
    try {
      const { hlsUrl, reason } = await attempt(url, budgetMs);
      if (hlsUrl) return { hlsUrl, reason: null };
      last = reason;
    } catch (err) {
      last = String(err?.message || err);
    }
  }
  return { hlsUrl: null, reason: last };
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */
const resolved = {};
const failures = [];
let done = 0;

const save = async () => {
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(resolved, null, 2)}\n`, "utf8");
};

for (const target of targets.values()) {
  const slugFailures = [];
  for (const page of target.pages) {
    const { hlsUrl, reason } = await resolvePage(page, timeoutMs, attempts);
    if (hlsUrl) {
      resolved[target.slug] = { hlsUrl, playerPage: page, embedUrl: target.embedUrl };
      console.log(`  ✓ ${target.slug.padEnd(20)} ${hlsUrl}`);
      break;
    }
    slugFailures.push({ slug: target.slug, page, reason });
    console.log(`  ✗ ${target.slug.padEnd(20)} ${page} → ${reason}`);
  }

  // A dead panel usually lives on another host of the shared pool: ask the
  // pool which hosts still serve this page before driving a browser at them.
  if (!resolved[target.slug] && target.embedUrl) {
    for (const variant of poolVariants(target.embedUrl)) {
      if (!(await servesPlayer(variant))) continue;
      const { hlsUrl, reason } = await resolvePage(variant, timeoutMs, 1);
      if (hlsUrl) {
        resolved[target.slug] = { hlsUrl, playerPage: variant, embedUrl: target.embedUrl };
        console.log(`  ✓ ${target.slug.padEnd(20)} ${hlsUrl} (pool)`);
        break;
      }
      slugFailures.push({ slug: target.slug, page: variant, reason });
    }
  }

  if (!resolved[target.slug]) {
    failures.push(slugFailures[slugFailures.length - 1]);
  }
  done++;
  if (done % 10 === 0) {
    await save();
    console.log(`  … ${done}/${targets.size} feeds, ${Object.keys(resolved).length} resolved`);
  }
}

await save();

console.log(`\n[resolve] ${Object.keys(resolved).length} resolved, ${failures.length} failure(s)`);
for (const f of failures) console.log(`   ! ${f.slug} — ${f.reason} (${f.page})`);
console.log(`[resolve] wrote ${outFile}`);

killEdge();
process.exit(0);
