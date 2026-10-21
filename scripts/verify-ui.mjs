/**
 * Headless verification driver.
 *
 * Launches Edge with the DevTools protocol, drives the real app, and writes
 * screenshots to docs/reviews/. Node built-ins only.
 *
 *   node scripts/verify-ui.mjs http://127.0.0.1:3111/
 */
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../docs/reviews");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const APP = process.argv[2] ?? "http://127.0.0.1:3111/";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(OUT, { recursive: true });

  const edge = spawn(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--remote-debugging-port=${PORT}`,
      "--user-data-dir=" + resolve(OUT, ".edge-profile"),
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      target = list.find((t) => t.type === "page");
    } catch {
      /* not up yet */
    }
  }
  if (!target) throw new Error("DevTools endpoint never came up");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    ws.addEventListener("open", resolveOpen, { once: true });
    ws.addEventListener("error", rejectOpen, { once: true });
  });

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
    new Promise((res) => {
      const msgId = ++id;
      pending.set(msgId, res);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const evaluate = async (expression) => {
    const msg = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return msg.result?.result?.value;
  };

  const shot = async (name) => {
    const msg = await send("Page.captureScreenshot", { format: "png" });
    if (!msg.result?.data) throw new Error(`no screenshot for ${name}`);
    const file = resolve(OUT, name);
    await writeFile(file, Buffer.from(msg.result.data, "base64"));
    console.log(`[shot] ${name}`);
    return file;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");

  const consoleErrors = [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      consoleErrors.push(msg.params.entry.text);
    }
    if (
      msg.method === "Runtime.exceptionThrown" &&
      msg.params.exceptionDetails?.text
    ) {
      consoleErrors.push(msg.params.exceptionDetails.text);
    }
  });

  await send("Page.navigate", { url: APP });
  await sleep(4000);

  console.log("[title]", await evaluate("document.title"));
  console.log(
    "[counts]",
    await evaluate(
      `JSON.stringify({ cards: document.querySelectorAll('article').length, rails: document.querySelectorAll('section').length, h1: document.querySelector('h1')?.textContent })`,
    ),
  );

  await shot("01-home.png");

  // Full page.
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 2400,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(1200);
  await shot("02-home-full.png");
  await send("Emulation.clearDeviceMetricsOverride");

  // Favourite -> celebration particles.
  await evaluate(
    `(() => { const b = document.querySelector("button[aria-label^='Adaugă']"); if (b) { b.click(); return b.getAttribute('aria-label'); } return null; })()`,
  );
  await sleep(900);
  await shot("03-favourite-confetti.png");

  // Open the player modal.
  await evaluate(
    `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('Vizionează acum')); if (b) { b.click(); return true; } return false; })()`,
  );
  await sleep(4000);
  console.log(
    "[modal]",
    await evaluate(
      `JSON.stringify({ dialog: !!document.querySelector("[role='dialog']"), iframe: document.querySelector("[role='dialog'] iframe")?.src ?? null, text: document.querySelector("[role='dialog']")?.innerText.replace(/\\s+/g,' ').slice(0,200) ?? null })`,
    ),
  );
  await shot("04-player-modal.png");

  // Search.
  await evaluate(
    `(() => { const i = document.querySelector("input[type='search']"); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(i, 'hbo'); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`,
  );
  await sleep(1500);
  console.log(
    "[search]",
    await evaluate(
      `JSON.stringify({ h1: document.querySelector('main h1')?.textContent, results: document.querySelectorAll('article').length })`,
    ),
  );
  await shot("05-search.png");

  // Mobile width.
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  // Close the player and clear the search before the mobile shot.
  await evaluate(
    `(() => {
      const i = document.querySelector("input[type='search']");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(i, '');
      i.dispatchEvent(new Event('input', { bubbles: true }));
      const close = document.querySelector("[role='dialog'] button[aria-label='Închide']");
      if (close) close.click();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return true;
    })()`,
  );
  await sleep(1500);
  await shot("06-mobile.png");
  await send("Emulation.clearDeviceMetricsOverride");

  console.log(
    "[console errors]",
    consoleErrors.length ? JSON.stringify(consoleErrors.slice(0, 8), null, 1) : "none",
  );

  ws.close();
  edge.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
