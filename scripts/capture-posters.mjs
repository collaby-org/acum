/**
 * Show stills for the channel cards.
 *
 * The backdrops have to be the real broadcast picture, so the frames are taken
 * from the app itself: the channel is found through the search panel, opened
 * in the player, and the picture is copied out of the running video. Nothing
 * is fetched from an upstream directly — the app's own proxy is the only way
 * in, which is also the only way to get a frame that matches what a visitor
 * would see.
 *
 *   node scripts/capture-posters.mjs [options]
 *
 *     --app=<url>            the running app (default http://127.0.0.1:3115/)
 *     --only=<id,id>         only these catalogue ids (names work too)
 *     --limit=<n>            stop after this many channels
 *     --force                overwrite posters that already exist
 *     --out=<dir>            where the frames go (default public/posters)
 *     --manifest=<file>      the manifest (default data/posters.json)
 *     --contact-sheet=<file> one image with every frame in a grid
 *     --timeout=<ms>         how long one channel may take (default 45000)
 *     --settle=<ms>          how long to wait past the first frame (default 2500)
 *     --sheet-only           only rebuild the contact sheet
 *
 * A channel whose stream is dead simply produces no frame: it is written down
 * as a miss and the run moves on. One dead channel never ends the run.
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const EDGE =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CDP_PORT = Number(process.env.CDP_PORT ?? 9412);
const APP = "http://127.0.0.1:3115/";

/* ------------------------------------------------------------------ *
 * Options
 * ------------------------------------------------------------------ */

const options = {
  app: APP,
  only: null,
  limit: Infinity,
  force: false,
  out: resolve(ROOT, "public/posters"),
  manifest: resolve(ROOT, "data/posters.json"),
  contactSheet: resolve(
    tmpdir(),
    "opencode/posters-shots/contact-sheet.jpg",
  ),
  timeout: 45000,
  settle: 2500,
  sheetOnly: false,
};

for (const raw of process.argv.slice(2)) {
  const [key, ...rest] = raw.replace(/^--/, "").split("=");
  const value = rest.join("=");
  switch (key) {
    case "app":
      options.app = value;
      break;
    case "only":
      options.only = value
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean);
      break;
    case "limit":
      options.limit = Number(value);
      break;
    case "force":
      options.force = true;
      break;
    case "out":
      options.out = resolve(ROOT, value);
      break;
    case "manifest":
      options.manifest = resolve(ROOT, value);
      break;
    case "contact-sheet":
      options.contactSheet = resolve(value);
      break;
    case "timeout":
      options.timeout = Number(value);
      break;
    case "settle":
      options.settle = Number(value);
      break;
    case "sheet-only":
      options.sheetOnly = true;
      break;
    default:
      console.log(`unknown option --${key}`);
      break;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The size every poster is stored at. */
const POSTER_WIDTH = 640;
const POSTER_HEIGHT = 360;

/* ------------------------------------------------------------------ *
 * The catalogue
 * ------------------------------------------------------------------ */

/**
 * The catalogue, read from the generated file.
 *
 * The generated file is JSON inside a TypeScript file, so the array literal
 * is sliced out and parsed. Reading it here — rather than trusting the
 * running app — keeps the manifest keys honest: they are the ids the rest
 * of the project uses.
 */
async function readCatalogue() {
  const source = await readFile(resolve(ROOT, "src/data/channels.ts"), "utf8");
  const marker = source.indexOf("export const CHANNELS");
  if (marker === -1) throw new Error("CHANNELS not found in the catalogue");
  const open = source.indexOf("= [", marker) + 2;
  const close = source.lastIndexOf("];");
  return JSON.parse(source.slice(open, close + 1));
}

/* ------------------------------------------------------------------ *
 * The browser
 * ------------------------------------------------------------------ */

class Browser {
  constructor(edge, port) {
    this.edge = edge;
    this.port = port;
    this.id = 0;
    this.pending = new Map();
    /** Set when the connection is gone, so the run can stop instead of hang. */
    this.dead = false;
    /** The embedded players that came with the page, by session. */
    this.frames = new Map();
  }

  static async launch(edge, port) {
    const profile = resolve(
      tmpdir(),
      "opencode/posters-shots/.edge-profile",
    );
    const child = spawn(
      edge,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--autoplay-policy=no-user-gesture-required",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        "--window-size=1440,900",
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    let ready = false;
    for (let i = 0; i < 80 && !ready; i++) {
      await sleep(250);
      try {
        ready = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
      } catch {
        /* not up yet */
      }
    }
    if (!ready) {
      child.kill();
      throw new Error("devtools never came up");
    }

    const browser = new Browser(child, port);
    await browser.connect();
    return browser;
  }

  async connect() {
    const created = await fetch(
      `http://127.0.0.1:${this.port}/json/new?${encodeURIComponent("about:blank")}`,
      { method: "PUT" },
    ).then((r) => r.json());

    this.ws = new WebSocket(created.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      this.ws.addEventListener("open", res, { once: true });
      this.ws.addEventListener("error", rej, { once: true });
    });

    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        this.pending.get(message.id)(message);
        this.pending.delete(message.id);
        return;
      }
      // An embedded player lives in a document of its own. It is attached
      // like a target of its own, and it is the only way to look inside it.
      if (
        message.method === "Target.attachedToTarget" &&
        message.params?.targetInfo?.type === "iframe"
      ) {
        this.frames.set(message.params.sessionId, message.params.targetInfo);
      }
    });

    // A connection that goes away must not leave a promise hanging for
    // ever: every call in flight is refused, and the run stops.
    this.ws.addEventListener("close", () => {
      this.dead = true;
      for (const [, reject] of this.pending) {
        reject(new Error("the browser connection closed"));
      }
      this.pending.clear();
    });

    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
    });
  }

  send(method, params = {}, sessionId) {
    return new Promise((res, rej) => {
      if (this.dead) {
        rej(new Error("the browser connection closed"));
        return;
      }
      const id = ++this.id;
      this.pending.set(id, (message) => {
        if (message.error) {
          res(Promise.reject(new Error(message.error.message)));
          return;
        }
        res(message);
      });
      try {
        const payload = { id, method, params };
        if (sessionId) payload.sessionId = sessionId;
        this.ws.send(JSON.stringify(payload));
      } catch (error) {
        this.pending.delete(id);
        rej(error);
      }
    });
  }

  /** Run a snippet in the page and bring the value back. */
  async evaluate(expression, sessionId) {
    const reply = await this.send(
      "Runtime.evaluate",
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId,
    );
    const details = reply.result?.exceptionDetails;
    if (details) {
      throw new Error(
        `evaluate failed: ${
          details.exception?.description ?? details.text ?? "unknown"
        }`,
      );
    }
    return reply.result?.result?.value;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
  }

  async screenshot(options = {}) {
    const reply = await this.send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 88,
      ...options,
    });
    if (!reply.result?.data) throw new Error("no screenshot data");
    return Buffer.from(reply.result.data, "base64");
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* already gone */
    }
    this.edge.kill();
  }
}

/**
 * Poll a snippet until it answers something truthy.
 *
 * The deadline is absolute: a channel gets one budget for the whole attempt,
 * so a stream that never starts costs the run a fixed amount of time and not
 * more.
 */
async function waitFor(browser, expression, deadline, step = 400, sessionId) {
  for (;;) {
    const value = await browser
      .evaluate(expression, sessionId)
      .catch(() => null);
    if (value) return value;
    if (Date.now() > deadline) return null;
    await sleep(step);
  }
}

/* ------------------------------------------------------------------ *
 * Driving the app
 * ------------------------------------------------------------------ */

/** Type into the header search field, the way a visitor does. */
const TYPE_QUERY = (query) => `(() => {
  const input = document.querySelector('header input[type="search"]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  ).set;
  setter.call(input, ${JSON.stringify(query)});
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;

/** The search results, as name and family pairs. */
const READ_RESULTS = `(() => {
  const out = [];
  for (const li of document.querySelectorAll('[role="search"] li')) {
    const button = li.querySelector("button");
    if (!button) continue;
    const spans = [...button.querySelectorAll("span.block.truncate")];
    out.push({
      name: (spans[0]?.textContent ?? "").trim(),
      family: (spans[1]?.textContent ?? "").trim(),
    });
  }
  return out;
})()`;

/** Click one result of the search panel, by its position in the list. */
const CLICK_RESULT = (index) => `(() => {
  const buttons = [...document.querySelectorAll('[role="search"] li')]
    .map((li) => li.querySelector("button"))
    .filter(Boolean);
  const button = buttons[${index}];
  if (!button) return false;
  button.scrollIntoView({ block: "center", behavior: "instant" });
  button.click();
  return true;
})()`;

/** What the player is showing right now. */
const READ_PLAYER = `(() => {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return { state: "no-dialog" };
  const video = dialog.querySelector("video");
  const frame = dialog.querySelector("iframe");
  const text = (dialog.innerText || "").replace(/\\s+/g, " ");
  return {
    state: "dialog",
    hasVideo: Boolean(video),
    readyState: video ? video.readyState : -1,
    currentTime: video ? video.currentTime : -1,
    width: video ? video.videoWidth : 0,
    height: video ? video.videoHeight : 0,
    hasVideoPlaying: Boolean(
      video && video.readyState >= 2 && video.currentTime > 0.2,
    ),
    hasFrame: Boolean(frame),
    failed: /nu poate fi redat|Fluxul nu este disponibil/i.test(text),
  };
})()`;

/**
 * Copy the picture out of the running video.
 *
 * The stream comes through the app's own proxy, so the canvas is not
 * tainted and the frame can be read pixel by pixel. A video that has not
 * started yet has nothing to give, and the caller falls back to a
 * screenshot of the player.
 */
const DRAW_FRAME = `(() => {
  try {
    const video = document.querySelector('[role="dialog"] video');
    if (!video || !video.videoWidth || !video.videoHeight) {
      return { ok: false, reason: "no picture" };
    }
    const width = ${POSTER_WIDTH};
    const height = ${POSTER_HEIGHT};
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
    const drawWidth = video.videoWidth * scale;
    const drawHeight = video.videoHeight * scale;
    ctx.drawImage(
      video,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    return {
      ok: true,
      data: canvas.toDataURL("image/jpeg", 0.86),
      width,
      height,
    };
  } catch (error) {
    return { ok: false, reason: String(error && error.message) };
  }
})()`;

/** Close the player and empty the search field. */
const RESET = `(() => {
  const input = document.querySelector('header input[type="search"]');
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return true;
})()`;

/* ------------------------------------------------------------------ *
 * The embedded player
 * ------------------------------------------------------------------ */

/** What the embedded player is showing, read from inside its own document. */
const FRAME_PICTURE = `(() => {
  const video = document.querySelector("video");
  if (!video) return { hasVideo: false };
  return {
    hasVideo: true,
    readyState: video.readyState,
    width: video.videoWidth,
    height: video.videoHeight,
    currentTime: video.currentTime,
    paused: video.paused,
  };
})()`;

/**
 * Start the embedded player.
 *
 * Some feeds have no playlist of their own, and the app falls back to the
 * channel page of the source, which shows a poster with a play button on
 * it. The button is pressed here, in the frame the app put on the screen —
 * the stream still comes through the app, only the start is ours.
 */
const FRAME_START = `(() => {
  const video = document.querySelector("video");
  if (video) {
    video.muted = true;
    const started = video.play();
    if (started && started.catch) started.catch(() => {});
    return "played";
  }
  const poster = [...document.querySelectorAll("a,button,[class*=play],[id*=play],[class*=poster],img")]
    .map((el) => ({ el, box: el.getBoundingClientRect() }))
    .filter(({ box }) => box.width > 160 && box.height > 90)
    .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)[0];
  if (!poster) return "nothing to press";
  poster.el.click();
  return "pressed " + poster.el.tagName;
})()`;

/**
 * The session of the embedded player that shows the given address.
 *
 * The frames of a page come with their own sessions; the one that belongs
 * to the player is found by the address it shows.
 */
async function frameSession(browser, src) {
  for (const [sessionId] of browser.frames) {
    const href = await browser
      .evaluate(`location.href`, sessionId)
      .catch(() => null);
    if (typeof href !== "string" || !href) continue;
    if (!src || href.startsWith(src.split("#")[0])) return sessionId;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * The app
 * ------------------------------------------------------------------ */

/** The server this run started itself, if any. */
let ownServer = null;

/** Is the app answering? */
async function reachable(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Make sure there is an app to shoot.
 *
 * A server that is already running is left alone — it belongs to whoever
 * started it. Only when there is none does this run start one of its own,
 * and that one is stopped again when the run ends.
 */
async function ensureApp() {
  if (await reachable(options.app)) {
    console.log(`the app is already running at ${options.app}`);
    return;
  }

  const port = new URL(options.app).port || "3000";
  const next = resolve(ROOT, "node_modules/next/dist/bin/next");
  console.log(`no app at ${options.app} — starting one on port ${port}`);
  ownServer = spawn(process.execPath, [next, "start", "--port", port], {
    cwd: ROOT,
    stdio: "ignore",
  });

  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    if (await reachable(options.app)) {
      console.log("the app is up");
      return;
    }
  }

  ownServer.kill();
  ownServer = null;
  throw new Error(
    "the app did not come up — build it first with `npm run build`",
  );
}

/* ------------------------------------------------------------------ *
 * One channel
 * ------------------------------------------------------------------ */

/**
 * Is the frame a black one?
 *
 * A stream that has not painted yet gives a perfectly uniform black frame.
 * A dark studio scene is not uniform, so the two are told apart by the
 * spread of the pixels and not by their brightness alone.
 */
async function looksBlack(bytes) {
  const sharp = await import("sharp").then((m) => m.default);
  const stats = await sharp(bytes).stats();
  const mean = Math.max(...stats.channels.map((c) => c.mean));
  const spread = Math.max(...stats.channels.map((c) => c.stdev));
  return mean < 10 && spread < 2;
}

/**
 * Shoot one channel.
 *
 * The search finds the channel, the player opens it, and the frame is taken
 * a couple of seconds after the picture starts, so the black first frame is
 * already behind us.
 */
async function shoot(browser, channel) {
  const deadline = Date.now() + options.timeout;

  // The search finds the channel. The typing is repeated when it does not
  // take, because a field that is still waking up keeps the first word.
  let results = null;
  for (let attempt = 0; attempt < 3 && !results; attempt++) {
    await browser.evaluate(TYPE_QUERY(channel.name));
    results = await waitFor(
      browser,
      `(() => {
        const rows = ${READ_RESULTS};
        return rows.some((row) => row.name === ${JSON.stringify(channel.name)})
          ? rows
          : null;
      })()`,
      Math.min(deadline, Date.now() + 6000),
      300,
    );
  }

  if (!results) return { ok: false, reason: "not found in the search" };

  const index = results.findIndex((row) => row.name === channel.name);
  await browser.evaluate(CLICK_RESULT(index));

  const player = await waitFor(
    browser,
    `(() => {
      const state = ${READ_PLAYER};
      return state.state === "dialog" ? state : null;
    })()`,
    deadline,
  );
  if (!player) return { ok: false, reason: "the player did not open" };

  // The picture: frames on screen, past the first black one.
  const live = await waitFor(
    browser,
    `(() => {
      const state = ${READ_PLAYER};
      if (state.failed) return { failed: true };
      if (state.hasVideo && state.readyState >= 2 && state.currentTime > 0.2) {
        return state;
      }
      // An embedded player has no video of our own — its picture lives in
      // another document, and the frame is the only sign that it is there.
      if (state.hasFrame) return state;
      return null;
    })()`,
    deadline,
    500,
  );

  if (!live) {
    const state = await browser.evaluate(READ_PLAYER);
    return {
      ok: false,
      reason: state?.failed
        ? "the stream refused to play"
        : "no picture before the timeout",
    };
  }

  // An embedded player has to be started by hand: the app falls back to the
  // channel page of the source, and that page shows a poster until somebody
  // presses it.
  if (live.hasFrame && !live.hasVideoPlaying) {
    const src = await browser.evaluate(
      `(() => { const f = document.querySelector('[role="dialog"] iframe'); return f ? f.src : null; })()`,
    );
    const session = await frameSession(browser, src);
    if (session) {
      await browser.evaluate(FRAME_START, session).catch(() => null);
      const running = await waitFor(
        browser,
        `(() => {
          const state = ${FRAME_PICTURE};
          return state.hasVideo && state.readyState >= 2 && state.width > 0
            ? state
            : null;
        })()`,
        deadline,
        700,
        session,
      );
      if (!running) {
        return {
          ok: false,
          reason: "the embedded player shows a page, not a stream",
        };
      }
    }
  }

  // Give the stream a moment so the frame is not the black one.
  await sleep(Math.min(options.settle, Math.max(0, deadline - Date.now())));

  // A frame that is still black means the picture has not arrived yet, so
  // it is worth another look while there is time left.
  for (let attempt = 0; attempt < 8; attempt++) {
    const drawn = await browser.evaluate(DRAW_FRAME);
    if (!drawn?.ok) {
      if (Date.now() > deadline - 1500) {
        return {
          ok: false,
          reason: drawn?.reason ?? "the player showed no picture",
        };
      }
      await sleep(1000);
      continue;
    }

    const bytes = Buffer.from(String(drawn.data).split(",")[1], "base64");
    if (bytes.length && !(await looksBlack(bytes))) {
      return {
        ok: true,
        bytes,
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        how: "canvas",
      };
    }

    if (attempt >= 1) break;
    if (Date.now() > deadline - 1500) break;
    await sleep(2000);
  }

  return { ok: false, reason: "the picture stayed black" };
}

/* ------------------------------------------------------------------ *
 * The manifest
 * ------------------------------------------------------------------ */

async function readManifest(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return { generatedAt: null, posters: {} };
  }
}

/**
 * Write the manifest.
 *
 * The manifest is written after every channel, so a run that is cut short
 * still leaves behind everything it managed to shoot.
 */
async function writeManifest(path, manifest) {
  manifest.generatedAt = new Date().toISOString();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

/* ------------------------------------------------------------------ *
 * The contact sheet
 * ------------------------------------------------------------------ */

/**
 * One image with every frame in a grid.
 *
 * The sheet is what makes the run judgeable by eye: a black or grey frame
 * from a dead stream cannot hide in a folder of files. Every tile carries
 * the name of its channel, so a missing one can be named straight away.
 */
async function writeContactSheet(path, entries) {
  if (entries.length === 0) return null;
  const sharp = await import("sharp").then((m) => m.default);
  const columns = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(entries.length))));
  const tileWidth = 320;
  const tileHeight = 180;
  const labelHeight = 24;
  const gap = 8;
  const cellHeight = tileHeight + labelHeight;

  const tiles = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const left = (i % columns) * (tileWidth + gap);
    const top = Math.floor(i / columns) * (cellHeight + gap);

    const picture = await sharp(entry.path)
      .resize(tileWidth, tileHeight, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();

    tiles.push({ input: picture, left, top });

    const label = entry.name
      ? entry.name.length > 30
        ? `${entry.name.slice(0, 29)}…`
        : entry.name
      : entry.id;
    const svg = `<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${tileWidth}" height="${labelHeight}" fill="#0c0c0e"/>
  <text x="8" y="17" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#e8e8ea">${escapeXml(label)}</text>
</svg>`;
    tiles.push({
      input: Buffer.from(svg),
      left,
      top: top + tileHeight,
    });
  }

  const rows = Math.ceil(entries.length / columns);
  const width = columns * (tileWidth + gap) - gap;
  const height = rows * (cellHeight + gap) - gap;

  await mkdir(dirname(path), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 12, g: 12, b: 14 },
    },
  })
    .composite(tiles)
    .jpeg({ quality: 82 })
    .toFile(path);

  return { width, height, columns, rows };
}

/** Names go into the sheet as SVG, so they have to be escaped. */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------------ *
 * The run
 * ------------------------------------------------------------------ */

async function main() {
  const catalogue = await readCatalogue();

  let wanted = catalogue;
  if (options.only) {
    wanted = catalogue.filter(
      (channel) =>
        options.only.includes(channel.id.toLowerCase()) ||
        options.only.includes(channel.name.toLowerCase()),
    );
    if (wanted.length === 0) {
      throw new Error(`no channel matches --only=${options.only.join(",")}`);
    }
  }
  wanted = wanted.slice(0, options.limit);

  await mkdir(options.out, { recursive: true });
  const manifest = await readManifest(options.manifest);

  console.log(
    `catalogue: ${catalogue.length} channels, ${wanted.length} to shoot, app ${options.app}`,
  );

  // The sheet can be rebuilt on its own, from the posters that are already
  // on disk — handy after a run that was cut short.
  if (options.sheetOnly) {
    const entries = [];
    for (const channel of catalogue) {
      const known = manifest.posters?.[channel.id];
      if (!known) continue;
      const path = join(options.out, known.file);
      try {
        await stat(path);
      } catch {
        continue;
      }
      entries.push({ id: channel.id, name: channel.name, path, ...known });
    }
    const sheet = await writeContactSheet(options.contactSheet, entries);
    console.log(
      `contact sheet: ${options.contactSheet} (${sheet.columns}x${sheet.rows} tiles, ${sheet.width}x${sheet.height})`,
    );
    return;
  }

  await ensureApp();

  const browser = await Browser.launch(EDGE, CDP_PORT);
  console.log("browser up; loading the app…");
  await browser.navigate(options.app);
  // The app has to be alive before it can be typed at: a search field that
  // is not hydrated yet throws its input away.
  await waitFor(
    browser,
    `(() => {
      const input = document.querySelector('header input[type="search"]');
      if (!input) return false;
      return Object.keys(input).some((key) => key.startsWith("__react"));
    })()`,
    Date.now() + 90000,
    500,
  );
  await sleep(1000);

  const captured = [];
  const misses = [];
  const started = Date.now();

  for (let i = 0; i < wanted.length; i++) {
    const channel = wanted[i];
    const file = `${channel.id}.jpg`;
    const path = join(options.out, file);
    const label = `[${i + 1}/${wanted.length}] ${channel.id} (${channel.name})`;

    if (!options.force) {
      try {
        const info = await stat(path);
        const known = manifest.posters?.[channel.id];
        if (known) {
          console.log(`${label} — already there, kept`);
          captured.push({
            id: channel.id,
            name: channel.name,
            path,
            ...known,
            bytes: info.size,
            how: "kept",
          });
          continue;
        }
      } catch {
        /* no poster yet */
      }
    }

    let result;
    try {
      result = await shoot(browser, channel);
    } catch (error) {
      result = { ok: false, reason: `threw: ${error.message}` };
    }

    if (result.ok && result.bytes?.length) {
      await writeFile(path, result.bytes);
      const capturedAt = new Date().toISOString();
      manifest.posters[channel.id] = {
        file,
        capturedAt,
        width: result.width,
        height: result.height,
      };
      captured.push({
        id: channel.id,
        name: channel.name,
        path,
        capturedAt,
        width: result.width,
        height: result.height,
        bytes: result.bytes.length,
        how: result.how,
      });
      console.log(
        `${label} — ok ${result.width}x${result.height}, ${(result.bytes.length / 1024).toFixed(1)} kB, ${result.how}`,
      );
    } else {
      misses.push({ id: channel.id, name: channel.name, reason: result.reason });
      console.log(`${label} — MISS: ${result.reason}`);
    }

    await writeManifest(options.manifest, manifest);

    // The player and the search field are reset for the next channel, so a
    // dead stream cannot leak into the next one.
    await browser.evaluate(RESET).catch(() => undefined);
    await browser
      .send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Escape",
        code: "Escape",
        windowsVirtualKeyCode: 27,
      })
      .catch(() => undefined);
    await browser
      .send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Escape",
        code: "Escape",
        windowsVirtualKeyCode: 27,
      })
      .catch(() => undefined);
    await sleep(400);

    // A browser that has gone away cannot shoot the rest either.
    if (browser.dead) {
      console.log("the browser connection is gone; stopping the run");
      break;
    }
  }

  browser.close();

  await writeManifest(options.manifest, manifest);

  const sheet = await writeContactSheet(
    options.contactSheet,
    captured.filter((entry) => entry.path),
  ).catch((error) => {
    console.log(`contact sheet failed: ${error.message}`);
    return null;
  });

  const seconds = Math.round((Date.now() - started) / 1000);
  const sizes = captured.filter((e) => e.bytes);
  const average = sizes.length
    ? Math.round(
        sizes.reduce((sum, e) => sum + e.bytes, 0) / sizes.length / 1024,
      )
    : 0;

  console.log("\n=== run done ===");
  console.log(`captured: ${captured.length}`);
  console.log(`missed:   ${misses.length}`);
  console.log(`average file size: ${average} kB`);
  console.log(`time: ${Math.floor(seconds / 60)}m ${seconds % 60}s`);
  if (sheet) {
    console.log(
      `contact sheet: ${options.contactSheet} (${sheet.columns}x${sheet.rows} tiles, ${sheet.width}x${sheet.height})`,
    );
  }
  if (misses.length) {
    console.log("\nmisses:");
    for (const miss of misses) {
      console.log(`  ${miss.id} (${miss.name}) — ${miss.reason}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // A server this run started is this run's to stop.
    ownServer?.kill();
  });
