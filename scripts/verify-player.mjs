/**
 * Playback proof.
 *
 * Drives the running app in headless Edge over the DevTools protocol and
 * proves that ONE click on a channel card starts the picture — with no popup
 * window and no ad host in the network log.
 *
 *   node scripts/verify-player.mjs <appUrl> [channelName]
 *
 * Exits 0 when the picture runs, 1 otherwise. The evidence it prints is what
 * goes into the pull request.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const OUT = resolve(tmpdir(), "acum-verify-player");
const EDGE =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9391;
const APP = process.argv[2] ?? "http://127.0.0.1:3112/";
const WANT = process.argv[3] ?? "Antena 1";

const AD_HOSTS = [
  "acscdn.com",
  "adexchangerapid.com",
  "usrpubtrk.com",
  "googletagmanager.com",
  "google-analytics.com",
  "doubleclick.net",
];

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
const consoleLines = [];

ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
    return;
  }
  if (!m.method) return;
  events.push(m);
  if (m.method === "Runtime.consoleAPICalled") {
    consoleLines.push(
      `${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`,
    );
  }
  if (m.method === "Runtime.exceptionThrown") {
    consoleLines.push(
      `exception: ${m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text}`,
    );
  }
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
await send("Target.setDiscoverTargets", { discover: true });

const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.result?.exceptionDetails) {
    throw new Error(
      `evaluate failed: ${r.result.exceptionDetails.exception?.description ?? "unknown"}`,
    );
  }
  return r.result?.result?.value;
};

console.log("waiting for the app…");
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

const pageState = await evaluate(`(() => ({
  title: document.title,
  cards: document.querySelectorAll('[data-card-action="play"]').length,
  body: document.body.innerText.slice(0, 200),
}))()`);
console.log("page:", JSON.stringify(pageState));

const target = await evaluate(`(() => {
  const cards = [...document.querySelectorAll('[data-card-action="play"]')];
  const wanted = cards.filter(c => (c.getAttribute('aria-label') || '').includes(${JSON.stringify(WANT)}));
  const pool = wanted.length ? wanted : cards;
  // A card can be scrolled out of its rail, so pick one whose centre really
  // is the topmost element at that point.
  for (const card of pool) {
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

const targetsBefore = events.filter(
  (e) => e.method === "Target.targetCreated" && e.params.targetInfo.type === "page",
).length;

await mouse("mousePressed", target.x, target.y);
await sleep(60);
await mouse("mouseReleased", target.x, target.y);

console.log("clicked; waiting for playback…");

let video = null;
for (let i = 0; i < 60; i++) {
  await sleep(1000);
  video = await evaluate(`(() => {
    const v = document.querySelector('video');
    const dialog = document.querySelector('[role="dialog"]');
    return {
      hasVideo: Boolean(v),
      hasDialog: Boolean(dialog),
      readyState: v ? v.readyState : -1,
      currentTime: v ? v.currentTime : -1,
      paused: v ? v.paused : null,
      src: v ? (v.currentSrc || v.src || '').slice(0, 120) : '',
      w: v ? v.videoWidth : 0,
      h: v ? v.videoHeight : 0,
      text: document.body.innerText.slice(0, 160),
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

console.log("video:", JSON.stringify(video));
console.log("after 4s:", JSON.stringify(second));

const requests = events
  .filter((e) => e.method === "Network.requestWillBeSent")
  .map((e) => ({
    url: e.params.request.url,
    type: e.params.type,
    method: e.params.request.method,
  }));

const pages = events
  .filter((e) => e.method === "Target.targetCreated")
  .map((e) => e.params.targetInfo)
  .filter((t) => t.type === "page");
const popups = pages.slice(targetsBefore);

const adHits = requests.filter((r) =>
  AD_HOSTS.some((host) => r.url.includes(host)),
);
const upstreamHits = requests.filter((r) =>
  /canale-tv|yozefina|vizionman|lozixy|ronanx|visionxman|tharen|sanseny/.test(r.url),
);

console.log("\n=== requests (" + requests.length + ") ===");
for (const r of requests) console.log(`${r.method} ${r.type} ${r.url}`);

console.log("\n=== ad hosts ===");
console.log(adHits.length === 0 ? "none" : JSON.stringify(adHits, null, 2));

console.log("\n=== upstream hosts touched by the browser ===");
console.log(upstreamHits.length === 0 ? "none" : JSON.stringify(upstreamHits, null, 2));

console.log("\n=== console ===");
console.log(consoleLines.slice(0, 40).join("\n") || "(empty)");

const ok =
  video.hasVideo &&
  video.readyState >= 2 &&
  second.currentTime > first &&
  adHits.length === 0 &&
  popups.length === 0;

console.log("\nRESULT:", ok ? "PASS" : "FAIL");
console.log(
  JSON.stringify(
    {
      readyState: second.readyState,
      currentTimeStart: first,
      currentTimeEnd: second.currentTime,
      delta: second.currentTime - first,
      adRequests: adHits.length,
      newPageTargets: popups.length,
      videoSize: `${video.w}x${video.h}`,
      paused: video.paused,
    },
    null,
    2,
  ),
);

ws.close();
edge.kill();
process.exit(ok ? 0 : 1);
