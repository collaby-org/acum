/**
 * The phone: the channel route, the back control and the bottom bar.
 *
 * The desktop is a dialog; on a phone the channel is a page, and in an
 * installed app there is no browser chrome to go back with — so the page
 * has to carry its own way out.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { installSession } from "./harness-signin.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(tmpdir(), "acum-verify-mobile");
const APP = process.argv[2] ?? "http://127.0.0.1:3115/";
const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const edge = spawn(EDGE, [
  "--headless=new",
  "--remote-debugging-port=9333",
  `--user-data-dir=${OUT}\\.profile`,
  "--disable-gpu",
  "--no-first-run",
  "--window-size=390,844",
  "--hide-scrollbars",
  "about:blank",
]);
await new Promise((r) => setTimeout(r, 2500));

const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
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

// The product is account-gated: the harness has to be signed in.
await installSession(send);
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});

/** The channel route, as a phone reaches it. */
await send("Page.navigate", { url: `${APP}canal/pro-tv` });
await new Promise((r) => setTimeout(r, 6000));

const page = await evaluate(`(() => {
  const back = [...document.querySelectorAll('button,a')].find((el) =>
    (el.getAttribute('aria-label') || '').includes('catalog') ||
    (el.textContent || '').trim() === 'Înapoi',
  );
  const nav = document.querySelector('[data-slot="mobile-nav"]');
  const video = document.querySelector('video');
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  return {
    url: location.pathname,
    title: document.title,
    backFound: Boolean(back),
    backText: back ? (back.textContent || '').trim() : null,
    backRect: rect(back),
    navFound: Boolean(nav),
    navRect: rect(nav),
    navFixed: nav ? getComputedStyle(nav).position : null,
    hasVideo: Boolean(video),
    videoRect: rect(video),
    panelFound: Boolean(document.querySelector('[data-slot="channel-panel"]')),
    panelText: (document.querySelector('[data-slot="channel-panel"]')?.innerText || '').slice(0, 240),
  };
})()`);

console.log("=== the channel route on a phone ===");
console.log(JSON.stringify(page, null, 2));

// The back control has to work in an installed app, where there is no
// history to lean on — it is a real link to the catalogue.
const back = await evaluate(`(() => {
  const el = [...document.querySelectorAll('button,a')].find((n) =>
    (n.getAttribute('aria-label') || '').includes('catalog') ||
    (n.textContent || '').trim() === 'Înapoi',
  );
  if (!el) return 'no button';
  el.click();
  return 'clicked';
})()`);
console.log("back:", back);
await new Promise((r) => setTimeout(r, 3000));
const after = await evaluate(`({ url: location.pathname, hasNav: Boolean(document.querySelector('[data-slot="mobile-nav"]')) })`);
console.log("after going back:", JSON.stringify(after));

const shot = await send("Page.captureScreenshot", { format: "png" });
const { writeFile } = await import("node:fs/promises");
await writeFile(resolve(OUT, "channel-route.png"), Buffer.from(shot.result.data, "base64"));
console.log("shot:", resolve(OUT, "channel-route.png"));

const pass =
  page.backFound &&
  page.navFound &&
  page.navFixed === "fixed" &&
  page.panelFound &&
  after.url === "/";
console.log("RESULT:", pass ? "PASS" : "FAIL");

ws.close();
edge.kill();
process.exit(pass ? 0 : 1);
