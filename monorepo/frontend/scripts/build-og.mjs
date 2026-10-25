/**
 * The Open Graph card.
 *
 *   node scripts/build-og.mjs
 *
 * Renders `public/og.png` — the 1200 × 630 card a link preview shows.
 *
 * It is drawn in headless Edge rather than in an image library, because the
 * wordmark has to be set in the real Space Grotesk, with the real diacritics
 * and the real tracking, and because the browser is what every scraper will
 * see. Node built-ins only.
 */
import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "public/brand/og.png");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;

const WIDTH = 1200;
const HEIGHT = 630;

/** The mark, drawn once, exactly as `scripts/build-icons.mjs` draws it. */
const MARK = `
  <svg viewBox="0 0 100 100" width="176" height="176">
    <defs>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFE7B0"/>
        <stop offset="0.38" stop-color="#F7B733"/>
        <stop offset="0.72" stop-color="#DE9206"/>
        <stop offset="1" stop-color="#9C6600"/>
      </linearGradient>
      <linearGradient id="rail" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#D98F04"/>
        <stop offset="0.55" stop-color="#FFC95E"/>
        <stop offset="1" stop-color="#FFF3D4"/>
      </linearGradient>
    </defs>
    <rect x="59" y="54" width="33" height="12" rx="6" fill="url(#rail)"/>
    <path d="M12 88 L50 14 L88 88 L70 88 L50 49 L30 88 Z" fill="url(#gold)"/>
  </svg>`;

const fontUrl = (file) => pathToFileURL(resolve(ROOT, "public/fonts", file)).href;

function card() {
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: "Space Grotesk";
    src: url("${fontUrl("space-grotesk-700-latin-ext.woff2")}") format("woff2");
    font-weight: 700;
  }
  @font-face {
    font-family: "Inter";
    src: url("${fontUrl("inter-400-700-latin-ext.woff2")}") format("woff2");
    font-weight: 400 700;
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body {
    position: relative;
    background: #04050a;
    font-family: "Inter", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .field {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(52% 78% at 16% 82%, rgba(242,167,27,0.26) 0%, rgba(242,167,27,0) 62%),
      radial-gradient(46% 60% at 88% 8%, rgba(56,120,214,0.16) 0%, rgba(56,120,214,0) 66%),
      linear-gradient(180deg, #0a0d16 0%, #04050a 62%, #04050a 100%);
  }
  .grain {
    position: absolute;
    inset: 0;
    opacity: 0.05;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  .stage {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    gap: 52px;
    padding: 0 88px;
  }
  .tile {
    width: 200px;
    height: 200px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 48px;
    border: 1px solid rgba(255,255,255,0.10);
    background: linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 100%);
    box-shadow: 0 34px 80px -30px rgba(242,167,27,0.6);
  }
  .word {
    font-family: "Space Grotesk", system-ui, sans-serif;
    font-weight: 700;
    font-size: 116px;
    line-height: 1;
    letter-spacing: 0.16em;
    color: #f4f6fb;
  }
  .rule {
    width: 76px;
    height: 3px;
    margin: 28px 0 22px;
    border-radius: 999px;
    background: linear-gradient(90deg, #FFE7B0 0%, #F2A71B 100%);
  }
  .tag {
    font-size: 32px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: #949cb2;
  }
  .foot {
    position: absolute;
    left: 88px;
    bottom: 52px;
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #5f687d;
  }
  .dot { width: 6px; height: 6px; border-radius: 999px; background: #f2a71b; }
</style>
</head>
<body>
  <div class="field"></div>
  <div class="grain"></div>
  <div class="stage">
    <div class="tile">${MARK}</div>
    <div>
      <div class="word">ACUM</div>
      <div class="rule"></div>
      <div class="tag">TV live românesc, fără reclame și fără cont</div>
    </div>
  </div>
  <div class="foot">
    <span>Ce rulează acum</span>
    <span class="dot"></span>
    <span>143 de canale</span>
  </div>
</body>
</html>`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const work = await mkdtemp(resolve(tmpdir(), "acum-og-"));
  const page = resolve(work, "card.html");
  await writeFile(page, card(), "utf8");

  const edge = spawn(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--allow-file-access-from-files",
      `--remote-debugging-port=${PORT}`,
      "--user-data-dir=" + resolve(work, "profile"),
      `--window-size=${WIDTH},${HEIGHT}`,
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
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: pathToFileURL(page).href });
  await sleep(2500);

  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (!shot.result?.data) throw new Error("no screenshot");
  await writeFile(OUT, Buffer.from(shot.result.data, "base64"));
  console.log(`[og] ${OUT.replace(ROOT + "\\", "")}`);

  ws.close();
  edge.kill();
  // Edge keeps the profile locked for a moment after it is killed.
  await sleep(1200);
  await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }).catch(
    () => {},
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
