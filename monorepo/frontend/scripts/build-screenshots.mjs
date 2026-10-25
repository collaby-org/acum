/**
 * The PWA store screenshots.
 *
 *   node scripts/build-screenshots.mjs [url]
 *
 * Writes `public/screenshots/home-narrow.png` (1080 × 1920) and
 * `public/screenshots/home-wide.png` (1920 × 1080) — the two frames the
 * manifest declares and the app stores show.
 *
 * The screenshots are part of the identity: they are the first thing a
 * visitor sees in an install prompt, so they have to carry the current
 * wordmark and the current mark. Re-run this after a rebrand.
 *
 * Node built-ins only.
 */
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "public/screenshots");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9336;
const APP = process.argv[2] ?? "http://127.0.0.1:3000/";

/** The two frames, and the device each one is taken on. */
const FRAMES = [
  {
    file: "home-narrow.png",
    width: 360,
    height: 640,
    deviceScaleFactor: 3,
    mobile: true,
  },
  {
    file: "home-wide.png",
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  },
];

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
      "--window-size=1920,1080",
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
  await new Promise((ok, fail) => {
    ws.addEventListener("open", ok, { once: true });
    ws.addEventListener("error", fail, { once: true });
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
    new Promise((ok) => {
      const msgId = ++id;
      pending.set(msgId, ok);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");

  for (const frame of FRAMES) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: frame.width,
      height: frame.height,
      deviceScaleFactor: frame.deviceScaleFactor,
      mobile: frame.mobile,
    });
    await send("Page.navigate", { url: APP });
    // The catalogue is a client island: give it time to paint and settle.
    await sleep(9000);
    await send("Runtime.evaluate", {
      expression: "window.scrollTo(0, 0)",
    });
    await sleep(600);

    const shot = await send("Page.captureScreenshot", { format: "png" });
    if (!shot.result?.data) throw new Error(`no screenshot for ${frame.file}`);
    await writeFile(resolve(OUT, frame.file), Buffer.from(shot.result.data, "base64"));
    console.log(`[shot] public/screenshots/${frame.file}`);
  }

  ws.close();
  edge.kill();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
