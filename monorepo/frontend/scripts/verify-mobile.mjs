/**
 * The phone: the channel route, the back control and the bottom bar.
 *
 * The desktop is a dialog; on a phone the channel is a page, and in an
 * installed app there is no browser chrome to go back with — so the page
 * has to carry its own way out.
 *
 *   node scripts/verify-mobile.mjs https://acum-weld.vercel.app/
 *
 * The URL is optional; with no argument the deployed site is checked.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { installSession } from "./harness-signin.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(tmpdir(), "acum-verify-mobile");
const APP = (
  process.argv[2] ?? "https://acum-weld.vercel.app/"
).replace(/\/$/, "");
const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
/** A representative iPhone safe-area inset, in CSS pixels. */
const SAFE_TOP = 59;

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

// The product is account-gated: the harness has to be signed in.
await installSession(send);
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
// Desktop Edge reports a zero safe-area inset. Give the page the same
// top inset an iPhone reports in standalone mode, so the notch rule is
// measured instead of being hidden by the test browser.
try {
  await send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: SAFE_TOP, bottom: 34, left: 0, right: 0 },
  });
} catch (error) {
  console.log(`NOTE  safe-area emulation is unavailable: ${error.message}`);
}

/** The channel route, as a phone reaches it. */
await send("Page.navigate", { url: `${APP}/canal/pro-tv` });
await new Promise((r) => setTimeout(r, 6000));

const page = await evaluate(`(() => {
  const back = [...document.querySelectorAll('button,a')].find((el) =>
    (el.getAttribute('aria-label') || '').includes('catalog') ||
    (el.textContent || '').trim().startsWith('Înapoi'),
  );
  const nav = document.querySelector('[data-slot="mobile-nav"]');
  const video = document.querySelector('video');
  const header = back?.closest('header');
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top, 0px);';
  document.body.appendChild(probe);
  const safeTop = Math.round(parseFloat(getComputedStyle(probe).paddingTop) || 0);
  probe.remove();
  return {
    url: location.pathname,
    title: document.title,
    backFound: Boolean(back),
    backText: back ? (back.textContent || '').trim() : null,
    backRect: rect(back),
    headerFound: Boolean(header),
    headerRect: rect(header),
    safeTop,
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
    (n.textContent || '').trim().startsWith('Înapoi'),
  );
  if (!el) return 'no button';
  el.click();
  return 'clicked';
})()`);
console.log("back:", back);
await new Promise((r) => setTimeout(r, 3000));
const after = await evaluate(`({ url: location.pathname, hasNav: Boolean(document.querySelector('[data-slot="mobile-nav"]')) })`);
console.log("after going back:", JSON.stringify(after));

const checks = [
  {
    name: "the channel route is open",
    ok: page.url === "/canal/pro-tv",
    detail: page.url,
  },
  {
    name: "the channel has a picture",
    ok: page.hasVideo,
    detail: page.hasVideo ? "a video element is present" : "no video element",
  },
  {
    name: "the channel panel is present",
    ok: page.panelFound,
    detail: page.panelFound ? "present" : "missing",
  },
  {
    name: "the back control is present",
    ok: page.backFound,
    detail: page.backFound ? page.backText : "missing",
  },
  {
    name: "the phone navigation is present",
    ok: page.navFound,
    detail: page.navFound ? "present" : "missing",
  },
  {
    name: "the phone navigation is fixed",
    ok: page.navFixed === "fixed",
    detail: page.navFixed ?? "unknown",
  },
  {
    name: "the back control returns to the signed-in catalogue",
    ok: after.url === "/canale",
    detail: after.url,
  },
  {
    name: "the catalogue keeps the phone navigation",
    ok: after.hasNav,
    detail: after.hasNav ? "present" : "missing",
  },
  {
    name: "the harness emulates an iPhone safe-area inset",
    ok: page.safeTop === SAFE_TOP,
    detail: `${page.safeTop}px (expected ${SAFE_TOP}px)`,
  },
  {
    name: "the header clears the safe-area inset",
    ok:
      page.headerFound &&
      page.headerRect !== null &&
      page.headerRect.y >= page.safeTop,
    detail: page.headerRect
      ? `header y=${page.headerRect.y}px, safe-area inset=${page.safeTop}px`
      : "no header",
  },
  {
    name: "the back control clears the safe-area inset",
    ok:
      page.backFound &&
      page.backRect !== null &&
      page.backRect.y >= page.safeTop,
    detail: page.backRect
      ? `button y=${page.backRect.y}px, safe-area inset=${page.safeTop}px`
      : "no back control",
  },
];

console.log("\n=== the checks ===");
for (const check of checks) {
  console.log(`  ${check.ok ? "PASS" : "FAIL"}  ${check.name} — ${check.detail}`);
}
const pass = checks.every((check) => check.ok);
console.log("\nRESULT:", pass ? "PASS" : "FAIL");

const shot = await send("Page.captureScreenshot", { format: "png" });
const { writeFile } = await import("node:fs/promises");
await writeFile(resolve(OUT, "channel-route.png"), Buffer.from(shot.result.data, "base64"));
console.log("shot:", resolve(OUT, "channel-route.png"));

ws.close();
edge.kill();
process.exit(pass ? 0 : 1);
