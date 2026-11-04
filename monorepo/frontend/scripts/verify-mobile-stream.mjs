/**
 * The phone's picture: does it stay on the live edge, or does it roll back?
 *
 * On a phone the stream used to play for a few seconds, jump backwards a few
 * seconds and play the same seconds again — a loop, not a stream. This script
 * reproduces the phone on a deliberately slow line, watches the playhead for
 * half a minute and says exactly what it did.
 *
 *   node scripts/verify-mobile-stream.mjs https://acum-weld.vercel.app/
 *
 * It needs the harness credentials in the environment (the same four as the
 * other harnesses): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * ACUM_HARNESS_EMAIL, ACUM_HARNESS_PASSWORD.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { installSession } from "./harness-signin.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(tmpdir(), "acum-verify-mobile-stream");
const APP = (process.argv[2] ?? "http://127.0.0.1:3115/").replace(/\/$/, "");
const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9334;

/** How long the watch runs, and how often it looks. */
const WATCH_MS = 30_000;
const SAMPLE_MS = 500;

/** A line slow enough to make a phone behave like a phone. */
const SLOW_4G = {
  offline: false,
  latency: 180,
  downloadThroughput: (1.4 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const edge = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${OUT}\\.profile`,
  "--disable-gpu",
  "--no-first-run",
  "--window-size=390,844",
  "--hide-scrollbars",
  "about:blank",
]);
await new Promise((r) => setTimeout(r, 2500));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const target = list.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let id = 0;
const pending = new Map();
/** Every answer the proxy gave, so a refused playlist cannot hide. */
const responses = [];
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Network.responseReceived") {
    const { url, status, mimeType } = msg.params.response;
    if (url.includes("/api/stream") || url.includes("/api/player")) {
      responses.push({ url, status, mimeType, at: Date.now() });
    }
  }
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve_) => {
    const messageId = ++id;
    pending.set(messageId, resolve_);
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });
const evaluate = async (expression) => {
  const reply = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return reply.result?.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
// A phone is not a small desktop: the user agent is part of what the
// upstream and the CDN answer to.
await send("Network.setUserAgentOverride", {
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  platform: "Android",
});
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
// The slow line is the point: the rollback only shows up when the buffer
// cannot stay ahead of the playhead.
await send("Network.emulateNetworkConditions", SLOW_4G);

await installSession(send);
await send("Page.navigate", { url: `${APP}/canal/pro-tv` });

/** Wait for the picture, but not forever. */
const started = Date.now();
let ready = false;
while (Date.now() - started < 30_000) {
  await new Promise((r) => setTimeout(r, 500));
  const state = await evaluate(
    `(() => { const v = document.querySelector('video'); return v ? { rs: v.readyState, t: v.currentTime } : null; })()`,
  );
  if (state && state.rs >= 2 && state.t > 0) {
    ready = true;
    break;
  }
}

console.log(
  ready
    ? "the picture is up — watching the playhead"
    : "the picture never arrived within 30s",
);

const samples = [];
const watchUntil = Date.now() + WATCH_MS;
while (Date.now() < watchUntil) {
  const sample = await evaluate(
    `(() => {
      const v = document.querySelector('video');
      if (!v) return null;
      const buffered = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
      return {
        t: v.currentTime,
        readyState: v.readyState,
        paused: v.paused,
        buffered,
        networkState: v.networkState,
        seeking: v.seeking,
      };
    })()`,
  );
  if (sample) samples.push({ ...sample, at: Date.now() });
  await new Promise((r) => setTimeout(r, SAMPLE_MS));
}

const backwards = [];
for (let i = 1; i < samples.length; i += 1) {
  const delta = samples[i].t - samples[i - 1].t;
  if (delta < -0.75) {
    backwards.push({
      from: Number(samples[i - 1].t.toFixed(2)),
      to: Number(samples[i].t.toFixed(2)),
      by: Number((-delta).toFixed(2)),
      at: samples[i].at,
    });
  }
}

const first = samples[0];
const last = samples[samples.length - 1];
const advanced = first && last ? last.t - first.t : 0;
const totalBack = backwards.reduce((sum, jump) => sum + jump.by, 0);
const stalls = samples.filter((sample) => sample.paused).length;

/** The same moment played twice: the symptom the owner described. */
const revisited = backwards.some((jump) => jump.to <= jump.from);

console.log("\n=== the playhead on a slow line ===");
console.log(
  JSON.stringify(
    {
      samples: samples.length,
      firstSecond: first ? Number(first.t.toFixed(2)) : null,
      lastSecond: last ? Number(last.t.toFixed(2)) : null,
      advancedSeconds: Number(advanced.toFixed(2)),
      backwardsJumps: backwards.length,
      totalBackwardsSeconds: Number(totalBack.toFixed(2)),
      biggestJump: backwards.length
        ? Math.max(...backwards.map((jump) => jump.by))
        : 0,
      revisitedTheSameMoment: revisited,
      pausedSamples: stalls,
    },
    null,
    2,
  ),
);
if (backwards.length) {
  console.log("\nthe jumps:");
  for (const jump of backwards.slice(0, 12)) {
    console.log(
      `  ${jump.from}s → ${jump.to}s (back ${jump.by}s) at +${Math.round(
        (jump.at - samples[0].at) / 1000,
      )}s`,
    );
  }
}

const pass = ready && backwards.length === 0 && advanced > WATCH_MS / 1000 - 5;

console.log("\n=== what the proxy answered ===");
const byStatus = {};
for (const response of responses) {
  const key = `${response.status} ${response.mimeType ?? ""}`.trim();
  byStatus[key] = (byStatus[key] ?? 0) + 1;
}
console.log(JSON.stringify(byStatus, null, 2));
const refused = responses.filter((response) => response.status >= 400);
if (refused.length) {
  console.log(`\n${refused.length} refused answer(s):`);
  for (const response of refused.slice(0, 8)) {
    console.log(`  ${response.status} ${response.url.slice(0, 140)}`);
  }
}

console.log("\nRESULT:", pass ? "PASS" : "FAIL");

ws.close();
edge.kill();
process.exit(pass ? 0 : 1);
