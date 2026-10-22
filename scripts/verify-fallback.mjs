/**
 * Fallback proof.
 *
 * Opens a channel in the running app, then deliberately kills the first
 * stream request. The player has to notice, move to the next server of the
 * same channel, and keep the picture running.
 *
 *   node scripts/verify-fallback.mjs <appUrl> [channelName]
 *
 * Exits 0 when the picture survives the kill, 1 otherwise.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(tmpdir(), "acum-verify-fallback");
const EDGE =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9393;
const APP = process.argv[2] ?? "http://127.0.0.1:3112/";

/**
 * The fallback only proves something on a channel that actually has a second
 * feed to fall back to, so pick the first one the server hands back a chain
 * of two or more playable links for.
 */
async function pickChannel(appUrl) {
  if (process.argv[3]) return process.argv[3];
  try {
    const source = await readFileSync(
      resolve(__dirname, "..", "src", "data", "channels.ts"),
      "utf8",
    );
    const match = source.match(
      /export const CHANNELS: UpstreamChannel\[\] = ([\s\S]*?);\n\nexport const CHANNEL_COUNT/,
    );
    if (!match) return null;
    const channels = JSON.parse(match[1]);

    for (const channel of channels) {
      if (channel.servers.length < 2) continue;
      if (channel.status !== "live") continue;
      const response = await fetch(new URL("/api/player", appUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: channel.id }),
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const playable = (payload.sources ?? []).filter(
        (source) => source.playable && source.kind === "hls",
      );
      if (playable.length >= 2) return channel.name;
    }
  } catch {
    return null;
  }
  return null;
}

const APP_URL = new URL(APP).href;
const WANT = (await pickChannel(APP_URL)) ?? "";
if (WANT) console.log("channel under test:", WANT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const edge = spawn(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    "--autoplay-policy=no-user-gesture-required",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=" + resolve(OUT, ".profile"),
    "about:blank",
  ],
  { stdio: "ignore" },
);

let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  await sleep(500);
  try {
    ready = (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok;
  } catch {
    /* not up yet */
  }
}
if (!ready) {
  edge.kill();
  throw new Error("devtools never came up");
}

const created = await fetch(
  `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent("about:blank")}`,
  { method: "PUT" },
).then((r) => r.json());

const ws = new WebSocket(created.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", rej, { once: true });
});

let id = 0;
const pending = new Map();
const events = [];
let killed = 0;

ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
    return;
  }
  if (m.method) events.push(m);
});

const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

await send("Network.enable");
await send("Page.enable");
await send("Runtime.enable");
// Intercept only this app's stream requests, whatever port it runs on.
const APP_ORIGIN = new URL(APP).origin;
await send("Fetch.enable", {
  patterns: [{ urlPattern: `${APP_ORIGIN}/api/stream*` }],
});

ws.addEventListener("message", async (e) => {
  const m = JSON.parse(e.data);
  if (m.method !== "Fetch.requestPaused") return;
  if (killed === 0) {
    killed++;
    await send("Fetch.failRequest", {
      requestId: m.params.requestId,
      errorReason: "ConnectionFailed",
    });
    return;
  }
  await send("Fetch.continueRequest", { requestId: m.params.requestId });
});

const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return r.result?.result?.value;
};

await send("Page.navigate", { url: APP });
await sleep(9000);

for (let i = 0; i < 30; i++) {
  const hydrated = await evaluate(`(() => {
    const card = document.querySelector('[data-card-action="play"]');
    if (!card) return false;
    return Object.keys(card).some(k => k.startsWith('__react'));
  })()`);
  if (hydrated) break;
  await sleep(1000);
}

const target = await evaluate(`(() => {
  const cards = [...document.querySelectorAll('[data-card-action="play"]')];
  const wanted = cards.filter(c => (c.getAttribute('aria-label') || '').includes(${JSON.stringify(WANT)}));
  const pool = wanted.length ? wanted : cards;
  // A card can be scrolled out of its rail, so pick one whose centre really
  // is the topmost element at that point.
  for (const card of pool) {
    // Scroll it into view in both axes — the rail scrolls horizontally too.
    card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = card.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (!hit || !card.contains(hit)) continue;
    return { label: card.getAttribute('aria-label'), x, y };
  }
  return null;
})()`);

if (!target) {
  console.log("FAIL: no channel card on the page");
  ws.close();
  edge.kill();
  process.exit(1);
}
console.log("clicking:", target.label);

const mouse = (type, x, y) =>
  send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: "left",
    clickCount: 1,
    buttons: type === "mouseReleased" ? 0 : 1,
  });

await mouse("mousePressed", target.x, target.y);
await sleep(60);
await mouse("mouseReleased", target.x, target.y);

let video = null;
for (let i = 0; i < 90; i++) {
  await sleep(1000);
  video = await evaluate(`(() => {
    const v = document.querySelector('video');
    return {
      hasVideo: Boolean(v),
      readyState: v ? v.readyState : -1,
      currentTime: v ? v.currentTime : -1,
      paused: v ? v.paused : null,
      src: v ? (v.currentSrc || '').slice(-40) : '',
      text: document.body.innerText.slice(0, 200),
    };
  })()`);
  if (video.readyState >= 2 && video.currentTime > 0) break;
}

const first = video.currentTime;
await sleep(4000);
const second = await evaluate(`(() => {
  const v = document.querySelector('video');
  return { readyState: v ? v.readyState : -1, currentTime: v ? v.currentTime : -1 };
})()`);

const requests = events
  .filter((e) => e.method === "Network.requestWillBeSent")
  .map((e) => e.params.request.url)
  .filter((u) => u.includes("/api/stream"));

console.log("killed requests:", killed);
console.log("stream requests:", requests.length);
console.log("distinct stream links:", new Set(requests).size);
console.log("video:", JSON.stringify(video));
console.log("after 4s:", JSON.stringify(second));

const ok = killed === 1 && second.readyState >= 2 && second.currentTime > first;
console.log("\nRESULT:", ok ? "PASS" : "FAIL");

ws.close();
edge.kill();
process.exit(ok ? 0 : 1);
