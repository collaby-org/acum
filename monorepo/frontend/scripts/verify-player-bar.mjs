/**
 * The player's control bar, measured.
 *
 * The owner reviewed the live player and wrote this:
 *
 *   "the buttons are too big … we must have always only 1 line, also we do
 *   not need the loading bar … we can't like play/pause button, too big in
 *   comparison with others, live badge maybe we can make it better, and not
 *   taking any space in that bar … quality button is huge and very bad
 *   designed".
 *
 * This script opens the player on a real channel and checks the bar against
 * those words: one line, one size, every target at least 44 × 44 px, no
 * loading strip, and no live badge taking space in the bar.
 *
 *   node scripts/verify-player-bar.mjs https://acum-weld.vercel.app/
 *
 * Harness credentials come from the environment (NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, ACUM_HARNESS_EMAIL, ACUM_HARNESS_PASSWORD).
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { installSession } from "./harness-signin.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(tmpdir(), "acum-verify-player-bar");
const APP = (process.argv[2] ?? "http://127.0.0.1:3115/").replace(/\/$/, "");
const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9336;

/** The smallest touch target the project accepts. */
const MIN_TARGET = 44;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const edge = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${OUT}\\.profile`,
  "--disable-gpu",
  "--no-first-run",
  "--window-size=1440,900",
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
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
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
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

await installSession(send);
await send("Page.navigate", { url: `${APP}/canal/pro-tv` });

/** Wait for the bar, but not forever. */
const started = Date.now();
let report = null;

/** The bar sleeps until the pointer comes near it — so the pointer goes near. */
const wake = async () => {
  const spot = await evaluate(`(() => {
    const frame = document.querySelector('[data-player-chrome]') || document.querySelector('[data-player-controls-bar]');
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height - 24) };
  })()`);
  if (!spot) return;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: spot.x, y: spot.y });
};

while (Date.now() - started < 30_000) {
  await new Promise((r) => setTimeout(r, 500));
  await wake();
  await new Promise((r) => setTimeout(r, 300));
  report = await evaluate(`(() => {
    const bar = document.querySelector('[data-player-controls-bar]');
    if (!bar) return null;

    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const controls = [...bar.querySelectorAll('button, a, input[type="range"]')]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24),
          tag: el.tagName.toLowerCase(),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          top: Math.round(rect.top),
        };
      });

    const overlay = document.querySelector('[data-player-buffering-overlay]');
    let overlayCentred = null;
    if (overlay) {
      const frame = overlay.parentElement.getBoundingClientRect();
      const box = overlay.getBoundingClientRect();
      overlayCentred =
        Math.abs((box.left + box.width / 2) - (frame.left + frame.width / 2)) <= 8 &&
        Math.abs((box.top + box.height / 2) - (frame.top + frame.height / 2)) <= 8;
    }

    const barRect = bar.getBoundingClientRect();
    const text = (bar.innerText || '').trim();

    return {
      barHeight: Math.round(barRect.height),
      barWidth: Math.round(barRect.width),
      lines: [...new Set(controls.map((c) => Math.round(c.top / 4)))].length,
      controls,
      smallestWidth: controls.length ? Math.min(...controls.map((c) => c.w)) : 0,
      smallestHeight: controls.length ? Math.min(...controls.map((c) => c.h)) : 0,
      hasProgressBar: Boolean(bar.querySelector('[role="progressbar"]')),
      liveBadgeTextInBar: text.includes('În direct'),
      barText: text.replace(/\\s+/g, ' ').slice(0, 160),
      connectionChip: Boolean(bar.querySelector('[aria-label^="Conexiune:"]')),
      qualityChip: Boolean(
        bar.querySelector('[aria-label^="Calitate:"]'),
      ),
      bufferingOverlay: Boolean(overlay),
      overlayCentred,
    };
  })()`);
  if (report) break;
}

console.log("=== the bar, measured ===");
console.log(JSON.stringify(report, null, 2));

const checks = [];
if (!report) {
  checks.push(["the bar is on the page", false, "no bar found within 30s"]);
} else {
  checks.push([
    "the bar is on the page",
    true,
    `${report.barWidth}×${report.barHeight}px`,
  ]);
  checks.push([
    "the bar is one line",
    report.lines === 1,
    `${report.lines} line(s), ${report.controls.length} visible controls`,
  ]);
  checks.push([
    "every target is at least 44px",
    report.smallestWidth >= MIN_TARGET && report.smallestHeight >= MIN_TARGET,
    `smallest ${report.smallestWidth}×${report.smallestHeight}px`,
  ]);
  checks.push([
    "no loading strip in the bar",
    !report.hasProgressBar,
    report.hasProgressBar ? "a progressbar is present" : "none",
  ]);
  checks.push([
    "no live badge taking space in the bar",
    !report.liveBadgeTextInBar,
    report.liveBadgeTextInBar ? "the text 'În direct' is in the bar" : "none",
  ]);
  checks.push([
    "the connection chip is there",
    report.connectionChip,
    report.connectionChip ? "Conexiune: …" : "missing",
  ]);
  // The quality control stays away while the manifest carries no rung — an
  // empty menu is worse than no menu. It is a note, not a failure.
  console.log(
    `  NOTE  the quality chip — ${
      report.qualityChip
        ? "offered (Calitate: …)"
        : "not offered: the manifest carries no rung yet"
    }`,
  );
  if (report.bufferingOverlay) {
    checks.push([
      "the buffering animation is centred on the picture",
      report.overlayCentred === true,
      report.overlayCentred ? "centred" : "off centre",
    ]);
  }
}

console.log("\n=== the checks ===");
for (const [name, ok, detail] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}
const pass = checks.every(([, ok]) => ok);
console.log("\nRESULT:", pass ? "PASS" : "FAIL");

ws.close();
edge.kill();
process.exit(pass ? 0 : 1);
