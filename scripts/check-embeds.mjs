/**
 * Embed liveness probe.
 *
 * Every channel page on cool-etv.net ships an iframe pointing at a third-party
 * streaming host. This script asks each unique embed URL whether it actually
 * serves a player, so the app can tell the user which channels really play
 * and which ones the upstream host is currently refusing.
 *
 *   node scripts/check-embeds.mjs
 *
 * Writes data/embed-pages.json — the state of every embed *page*.
 *
 * The catalogue is built from the *feed* probe instead
 * (`scripts/probe-feeds.mjs` → `data/embed-health.json`): it walks the real
 * playback path and records whether the stream itself arrives, which is the
 * only thing the app may advertise. This file is the finer grain — the page
 * behind a feed — and it never overwrites the build input.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

/** Headers a real cross-site iframe navigation would carry. */
const HEADERS = {
  "user-agent": UA,
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "iframe",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "cross-site",
  "upgrade-insecure-requests": "1",
  referer: "https://www.cool-etv.net/",
};

/** Markers that identify a real HTML5 video player shell. */
const PLAYER_MARKERS = [
  "click-to-play",
  "warning-message",
  "UnMutePlayerx",
  "hls.js",
  "jwplayer",
  "videojs",
  "artplayer",
  "plyr",
  ".m3u8",
  "<video",
];

/**
 * The upstream kit builds its player at runtime: the page is a small
 * obfuscated shell that pulls the player in through these scripts. There is
 * nothing static to match, but the shell is unmistakably a player.
 */
const UPSTREAM_PLAYER_MARKERS = ["alpha.js", "omega1.js", "suppy.js", "var suki"];

const isPlayerShell = (body) =>
  PLAYER_MARKERS.some((m) => body.includes(m)) ||
  UPSTREAM_PLAYER_MARKERS.some((m) => body.includes(m));

const CLOUDFLARE_BLOCK = /Sorry, you have been blocked|Attention Required! \| Cloudflare/i;
const PARKED = /<title>Google<\/title>|google\.com\/sorry/i;

/** A direct media file — no player page around it. */
const DIRECT_MEDIA = /\.(m3u8|mp4|m4s|ts|flv)(?:$|\?)/i;

/** Markers of an upstream page that hosts its own player. */
const PLAYER_PAGE_MARKERS = ["click-to-play", 'id="player"', "id='player'"];

/**
 * True when the URL is a page that hosts a player (and therefore has to be
 * driven to find the media), false for a direct media URL.
 */
function isPlayerPage(url, body) {
  if (DIRECT_MEDIA.test(url)) return false;
  if (!body) return false;
  return PLAYER_PAGE_MARKERS.some((m) => body.includes(m));
}

function classify({ status, finalUrl, body }) {
  if (status === 403 || CLOUDFLARE_BLOCK.test(body)) return "blocked";
  if (PARKED.test(body.slice(0, 6000))) return "parked";
  if (/youtube\.com\/embed/i.test(finalUrl)) return "player";
  if (isPlayerShell(body)) return "player";
  return "unknown";
}

/**
 * The upstream panels sit behind a Cloudflare referer allowlist: they only
 * serve the player to the site that publishes the channel pages, and to their
 * own origin. Anything else gets a redirect to a parked page.
 */
const REFERERS = (url) => ["https://www.cool-etv.net/", `${new URL(url).origin}/`];

async function probe(url) {
  const rec = {
    url,
    host: new URL(url).host,
    status: null,
    finalUrl: null,
    state: "unknown",
    bytes: 0,
    playerPage: false,
    referer: null,
  };
  let lastError = null;
  for (const referer of REFERERS(url)) {
    try {
      const res = await fetch(url, {
        headers: { ...HEADERS, referer },
        redirect: "follow",
        signal: AbortSignal.timeout(25000),
      });
      const body = await res.text();
      rec.status = res.status;
      rec.finalUrl = res.url;
      rec.bytes = body.length;
      rec.state = classify({ status: res.status, finalUrl: res.url, body });
      rec.playerPage = isPlayerPage(res.url, body);
      rec.referer = referer;
      lastError = null;
      if (rec.state === "player") break;
    } catch (err) {
      lastError = String(err?.message || err);
      rec.referer = referer;
    }
  }
  if (lastError) {
    rec.state = "error";
    rec.error = lastError;
  }
  return rec;
}

const raw = JSON.parse(await readFile(resolve(ROOT, "data/channels.raw.json"), "utf8"));
const unique = [...new Set(raw.channels.map((c) => c.embedUrl).filter(Boolean))];
console.log(`[probe] ${unique.length} unique embed URLs`);

const results = [];
// Serial on purpose: a burst of parallel requests trips the upstream's
// bot window and the panels answer with a block instead of the player.
for (const url of unique) {
  results.push(await probe(url));
  await sleep(250);
}
results.sort((a, b) => a.url.localeCompare(b.url));

const tally = {};
for (const r of results) tally[r.state] = (tally[r.state] || 0) + 1;
console.log("[probe] states", tally);
console.log(
  "[probe] player pages",
  results.filter((r) => r.playerPage).length,
  "— other embeds are",
  results.filter((r) => !r.playerPage && r.state === "player").length,
  "runtime-built players",
);

const hosts = {};
for (const r of results) {
  hosts[r.host] ??= { total: 0, player: 0, blocked: 0, parked: 0, unknown: 0, error: 0 };
  hosts[r.host].total++;
  hosts[r.host][r.state]++;
}
console.log("[probe] hosts");
for (const [h, v] of Object.entries(hosts).sort((a, b) => b[1].total - a[1].total)) {
  console.log(
    `   ${h.padEnd(38)} total=${String(v.total).padStart(3)} player=${v.player} blocked=${v.blocked} parked=${v.parked} unknown=${v.unknown} error=${v.error}`,
  );
}

const target = resolve(ROOT, "data/embed-pages.json");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(results, null, 2), "utf8");
console.log(`[probe] wrote data/embed-pages.json`);
