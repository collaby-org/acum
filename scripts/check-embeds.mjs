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
 * Writes data/embed-health.json.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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

const CLOUDFLARE_BLOCK = /Sorry, you have been blocked|Attention Required! \| Cloudflare/i;
const PARKED = /<title>Google<\/title>|google\.com\/sorry/i;

function classify({ status, finalUrl, body }) {
  if (status === 403 || CLOUDFLARE_BLOCK.test(body)) return "blocked";
  if (PARKED.test(body.slice(0, 6000))) return "parked";
  if (/youtube\.com\/embed/i.test(finalUrl)) return "player";
  if (PLAYER_MARKERS.some((m) => body.includes(m))) return "player";
  return "unknown";
}

async function probe(url) {
  const rec = { url, host: new URL(url).host, status: null, finalUrl: null, state: "unknown", bytes: 0 };
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    rec.status = res.status;
    rec.finalUrl = res.url;
    const body = await res.text();
    rec.bytes = body.length;
    rec.state = classify({ status: res.status, finalUrl: res.url, body });
  } catch (err) {
    rec.state = "error";
    rec.error = String(err?.message || err);
  }
  return rec;
}

const raw = JSON.parse(await readFile(resolve(ROOT, "data/channels.raw.json"), "utf8"));
const unique = [...new Set(raw.channels.map((c) => c.embedUrl).filter(Boolean))];
console.log(`[probe] ${unique.length} unique embed URLs`);

const results = [];
let cursor = 0;
async function worker() {
  while (cursor < unique.length) {
    results.push(await probe(unique[cursor++]));
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
results.sort((a, b) => a.url.localeCompare(b.url));

const tally = {};
for (const r of results) tally[r.state] = (tally[r.state] || 0) + 1;
console.log("[probe] states", tally);

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

const target = resolve(ROOT, "data/embed-health.json");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(results, null, 2), "utf8");
console.log(`[probe] wrote data/embed-health.json`);
