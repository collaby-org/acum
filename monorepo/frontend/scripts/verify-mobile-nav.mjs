/**
 * The phone's bottom bar: does a tap do something, and how fast?
 *
 * The owner reported that the bar's buttons "do not work to go back home"
 * on a phone, that several taps were needed, and that the app answered
 * seconds later. This script measures exactly that on a phone-sized
 * viewport: what is under the button (an overlay that eats the tap?), and
 * how long the route takes to change after a real tap.
 *
 *   node scripts/verify-mobile-nav.mjs https://acum-weld.vercel.app/
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
const OUT = resolve(tmpdir(), "acum-verify-mobile-nav");
const APP = (process.argv[2] ?? "http://127.0.0.1:3115/").replace(/\/$/, "");
const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;

/** How long a tap may take before it counts as slow. */
const BUDGET_MS = 1200;

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
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await installSession(send);

/** The page the visitor is on when the complaint happens. */
const PAGE = process.argv[3] ?? "/preturi";
await send("Page.navigate", { url: `${APP}${PAGE}` });
await new Promise((r) => setTimeout(r, 6000));

const before = await evaluate(
  `(() => {
    const nav = document.querySelector('[data-slot="mobile-nav"]');
    if (!nav) return { nav: false };
    const button = [...nav.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Acasă'),
    );
    if (!button) return { nav: true, button: false };
    const rect = button.getBoundingClientRect();
    const x = Math.round(rect.x + rect.width / 2);
    const y = Math.round(rect.y + rect.height / 2);
    const top = document.elementFromPoint(x, y);
    return {
      nav: true,
      button: true,
      x,
      y,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      topTag: top ? top.tagName : null,
      topText: top ? (top.textContent || '').trim().slice(0, 60) : null,
      topIsTheButton: top ? button.contains(top) || top === button : false,
      pathname: location.pathname,
    };
  })()`,
);

console.log("=== the bar on a phone ===");
console.log(JSON.stringify(before, null, 2));

let after = before;
let elapsed = null;
if (before.nav && before.button) {
  // A real tap, at the coordinates a finger would use.
  const started = Date.now();
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", {
      type,
      x: before.x,
      y: before.y,
      button: "left",
      clickCount: 1,
    });
  }
  while (Date.now() - started < 10_000) {
    await new Promise((r) => setTimeout(r, 100));
    const state = await evaluate(`({ pathname: location.pathname })`);
    if (state && state.pathname !== before.pathname) {
      elapsed = Date.now() - started;
      after = state;
      break;
    }
  }
  if (elapsed === null) {
    elapsed = null;
    after = await evaluate(`({ pathname: location.pathname })`);
  }
}

console.log("\n=== after the tap ===");
console.log(JSON.stringify({ ...after, elapsedMs: elapsed }, null, 2));

const pass =
  Boolean(before.nav) &&
  Boolean(before.button) &&
  before.topIsTheButton === true &&
  elapsed !== null &&
  elapsed <= BUDGET_MS;
console.log(
  `\nRESULT: ${pass ? "PASS" : "FAIL"} — the tap must not be eaten and must answer within ${BUDGET_MS}ms`,
);

ws.close();
edge.kill();
process.exit(pass ? 0 : 1);
