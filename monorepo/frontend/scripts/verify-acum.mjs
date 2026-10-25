/**
 * The "Acum" check.
 *
 * The programme guide says what is on between two absolute timestamps and
 * nothing about the present, so "what is on now" is a question about the
 * clock. This check asks that question of the running app and insists on
 * the truth:
 *
 *   1. the card names the programme that is on air **at the real clock**,
 *      not the one that was on when the guide file was written;
 *   2. the card **moves** when the clock moves — the page is not reloaded,
 *      the minute tick is what changes it;
 *   3. the channel panel moves too, on the server's answer.
 *
 * The page's own clock is pushed forward with the DevTools virtual clock,
 * so the second proof takes seconds instead of a minute; if the virtual
 * clock will not budge, the check waits for the real minute instead. The
 * panel is answered by the server, so its proof always waits for the real
 * clock to turn the minute over.
 *
 *   "C:\Program Files\nodejs\node.exe" scripts/verify-acum.mjs [options]
 *
 *     --app=<url>       the running app (default http://127.0.0.1:3115/)
 *     --channel=<id>    the channel to check (default: the one whose next
 *                       programme starts soonest)
 *     --out=<dir>       where the evidence goes (default docs/reviews/acum)
 *     --skip-panel      do not wait for the panel's own minute
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installSession } from "./harness-signin.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const EDGE =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CDP_PORT = Number(process.env.CDP_PORT ?? 9414);
/** The panel's proof gets a browser of its own — see `provePanel`. */
const PANEL_CDP_PORT = Number(process.env.PANEL_CDP_PORT ?? 9415);

const options = {
  app: "http://127.0.0.1:3115/",
  channel: null,
  out: resolve(ROOT, "docs/reviews/acum"),
  skipPanel: false,
};

for (const raw of process.argv.slice(2)) {
  const [key, ...rest] = raw.replace(/^--/, "").split("=");
  const value = rest.join("=");
  switch (key) {
    case "app":
      options.app = value;
      break;
    case "channel":
      options.channel = value.trim().toLowerCase();
      break;
    case "out":
      options.out = resolve(ROOT, value);
      break;
    case "skip-panel":
      options.skipPanel = true;
      break;
    default:
      console.log(`unknown option --${key}`);
      break;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ *
 * The guide and the catalogue
 * ------------------------------------------------------------------ */

/**
 * Romanian copy with the correct diacritics.
 *
 * The feed writes the cedilla forms and the app rewrites them, so the
 * check rewrites them the same way before it compares two titles.
 */
function diacritics(value) {
  return String(value)
    .replace(/Ş/g, "Ș")
    .replace(/ş/g, "ș")
    .replace(/Ţ/g, "Ț")
    .replace(/ţ/g, "ț");
}

/** Fold a name down to comparable letters and digits. */
function foldKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .replace(/[ăâ]/g, "a")
    .replace(/[î]/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** The same key without the quality suffix or the feed number. */
function baseKey(value) {
  return foldKey(value)
    .replace(/(?:fhd|uhd|hd|sd)$/, "")
    .replace(/\d+$/, "");
}

/** The catalogue, read out of the generated module. */
async function readCatalogue() {
  const source = await readFile(resolve(ROOT, "src/data/channels.ts"), "utf8");
  const marker = source.indexOf("export const CHANNELS");
  if (marker === -1) throw new Error("CHANNELS not found in the catalogue");
  const open = source.indexOf("= [", marker) + 2;
  const close = source.lastIndexOf("];");
  return JSON.parse(source.slice(open, close + 1));
}

/** The guide, read off the file the app reads. */
async function readGuide() {
  return JSON.parse(await readFile(resolve(ROOT, "data/epg.json"), "utf8"));
}

/** The guide channel a catalogue channel belongs to, if any. */
function guideChannelFor(guide, channel) {
  const channels = guide?.channels ?? {};
  const candidates = [
    channel.id,
    channel.name,
    channel.family,
    channel.familyKey,
  ];
  for (const candidate of candidates) {
    const hit = channels[foldKey(candidate)];
    if (hit) return hit;
  }
  for (const candidate of candidates) {
    const key = baseKey(candidate);
    if (!key) continue;
    for (const [slug, entry] of Object.entries(channels)) {
      if (baseKey(slug) === key) return entry;
    }
  }
  return null;
}

/** The slots of a guide channel, with their moments. */
function slotsOf(guideChannel) {
  return (guideChannel?.programmes ?? [])
    .map((programme) => ({
      title: diacritics(programme.title),
      start: Date.parse(programme.startsAt),
      end: Date.parse(programme.endsAt),
    }))
    .filter((slot) => Number.isFinite(slot.start) && Number.isFinite(slot.end))
    .sort((a, b) => a.start - b.start);
}

/** The slot on air at a moment. */
function slotAt(slots, moment) {
  for (const slot of slots) {
    if (moment >= slot.start && moment < slot.end) return slot;
  }
  return null;
}

/**
 * How far the moment is from the edges of the slot it is in.
 *
 * The app reads the clock a moment later than the check does — the page
 * spent a second or two in transit — so a reading taken right at a change
 * could name the slot before and the slot after. A reading taken well
 * inside a slot cannot.
 */
function marginOf(slots, moment) {
  const slot = slotAt(slots, moment);
  if (!slot) return { slot: null, margin: 0 };
  return {
    slot,
    margin: Math.min(moment - slot.start, slot.end - moment),
  };
}

/** The next moment the schedule of a channel changes. */
function nextBoundary(slots, moment) {
  let boundary = null;
  for (const slot of slots) {
    if (slot.start > moment && (boundary === null || slot.start < boundary)) {
      boundary = slot.start;
    }
    if (
      slot.start <= moment &&
      slot.end > moment &&
      (boundary === null || slot.end < boundary)
    ) {
      boundary = slot.end;
    }
  }
  return boundary;
}

/**
 * The channel whose schedule changes soonest.
 *
 * The panel's proof has to wait for a changeover, so it takes the channel
 * that changes first — the wait is then as short as the guide allows.
 */
function soonest(catalogue, guide, only) {
  let best = null;
  const now = Date.now();
  for (const channel of catalogue) {
    if (only && channel.id !== only) continue;
    const guideChannel = guideChannelFor(guide, channel);
    if (!guideChannel) continue;
    const slots = slotsOf(guideChannel);
    if (!slotAt(slots, now)) continue;
    const boundary = nextBoundary(slots, now);
    if (boundary === null) continue;
    if (!best || boundary < best.boundary) {
      best = { channel, slots, boundary };
    }
  }
  return best;
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
    this.dead = false;
    /** Every request the page made, in order. */
    this.requests = [];
  }

  static async launch(edge, port) {
    const profile = resolve(
      process.env.TEMP ?? "C:/Windows/Temp",
      `opencode/acum-verify/.edge-profile-${port}`,
    );
    // A browser left over from an earlier run would take the profile and
    // quit: the new one hands its page to the old one, and the connection
    // dies a minute later.
    killEdge(profile);
    await rm(profile, { recursive: true, force: true }).catch(() => undefined);

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
      if (
        message.method === "Network.requestWillBeSent" &&
        message.params?.request?.url
      ) {
        this.requests.push(message.params.request.url);
      }
    });

    this.ws.addEventListener("close", () => {
      this.dead = true;
      for (const [, reject] of this.pending) {
        reject(new Error("the browser connection closed"));
      }
      this.pending.clear();
    });

    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Network.enable");
  }

  /** How many requests the page made to a path. */
  countRequests(path) {
    return this.requests.filter((url) => url.includes(path)).length;
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
          res(Promise.reject(new Error(`${method}: ${message.error.message}`)));
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

  async navigate(url, sessionId) {
    await this.send("Page.navigate", { url }, sessionId);
  }

  async screenshot(file, sessionId) {
    const reply = await this.send(
      "Page.captureScreenshot",
      { format: "png" },
      sessionId,
    );
    if (!reply.result?.data) throw new Error(`no screenshot for ${file}`);
    await writeFile(file, Buffer.from(reply.result.data, "base64"));
    return file;
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* already gone */
    }
    // The browser is a tree of processes: the parent alone leaves the
    // renderers behind, holding the profile.
    try {
      spawnSync("taskkill", ["/T", "/F", "/PID", String(this.edge.pid)], {
        stdio: "ignore",
      });
    } catch {
      /* the browser is already gone */
    }
    this.edge.kill();
  }
}

/**
 * Kill the browsers that are using a profile.
 *
 * A browser that is still running with the profile would take the new
 * page, and the new browser would quit — which reads as a connection that
 * closes a minute later.
 */
function killEdge(profile) {
  const list = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${profile.replace(/'/g, "''")}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
    ],
    { stdio: "ignore" },
  );
  if (list.status !== 0) {
    // The helper is a convenience, not a requirement.
  }
}

/* ------------------------------------------------------------------ *
 * Reading the page
 * ------------------------------------------------------------------ */

/**
 * Bring an element into view before it is read or pressed.
 *
 * The document scrolls smoothly, so a rectangle read straight after a
 * scroll is stale. The scroll is instant and the point is hit-tested
 * afterwards, so the click lands on the card and not on whatever the
 * smooth scroll happened to leave under the pointer.
 */
const REVEAL = (selector) => `(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return { ok: false, reason: "not found" };
  element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  const box = element.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const hit = document.elementFromPoint(x, y);
  return {
    ok: true,
    x: Math.round(x),
    y: Math.round(y),
    hit: hit
      ? (hit.closest("[data-channel-id]")?.getAttribute("data-channel-id") ?? hit.tagName)
      : null,
    inside: Boolean(hit && element.contains(hit)),
  };
})()`;

/**
 * The "Acum" line of a card.
 *
 * The card prints the mark and the title side by side, so the title is the
 * text of the line without the mark.
 */
const READ_CARD = (id) => `(() => {
  const card = document.querySelector('[data-channel-id="${id}"]');
  if (!card) return { found: false, reason: "the card is not on the page" };
  const mark = [...card.querySelectorAll("span")].find(
    (node) => node.textContent.trim() === "Acum",
  );
  if (!mark) {
    return { found: false, reason: "the card names no programme", text: null };
  }
  const line = mark.parentElement;
  return {
    found: true,
    text: line ? line.textContent.replace(/^\\s*Acum\\s*/, "").trim() : null,
    line: line ? line.textContent.replace(/\\s+/g, " ").trim() : null,
  };
})()`;

/** The "Acum" line of the channel panel. */
const READ_PANEL = `(() => {
  const panel = document.querySelector('[data-slot="channel-panel"]');
  if (!panel) return { found: false, reason: "the panel is not on the page" };
  const mark = [...panel.querySelectorAll("p,span")].find(
    (node) => node.textContent.trim() === "Acum",
  );
  if (!mark) return { found: false, reason: "the panel names no programme", text: null };
  const title = mark.nextElementSibling;
  return {
    found: true,
    text: title ? title.textContent.replace(/\\s+/g, " ").trim() : null,
  };
})()`;

/** The hero's programme: the title and the window it runs in. */
const READ_HERO = `(() => {
  const hero = document.querySelector('[aria-labelledby="hero-title"]');
  if (!hero) return { found: false };
  const title = hero.querySelector("#hero-title");
  const mark = [...hero.querySelectorAll("span")].filter(
    (node) => node.textContent.trim() === "Acum",
  );
  // The hero shows the programme twice: once on the screen, once in the
  // now/next strip under the copy. The screen is the one whose row is
  // followed by the title.
  const screen = mark.find((node) => {
    const next = node.parentElement?.nextElementSibling;
    return next && next.tagName === "P";
  });
  const bar = screen?.parentElement?.parentElement;
  const onAir = bar
    ? [...bar.querySelectorAll("p")].map((node) => node.textContent.replace(/\\s+/g, " ").trim()).filter(Boolean)[0] ?? null
    : null;
  const window = bar
    ? [...bar.querySelectorAll("span")].map((node) => node.textContent.trim()).find((text) => /^\\d{2}:\\d{2} — \\d{2}:\\d{2}$/.test(text)) ?? null
    : null;
  const countdown = [...hero.querySelectorAll("span")].map((node) =>
    node.textContent.replace(/\\s+/g, " ").trim(),
  ).find((text) => text.startsWith("până la")) ?? null;
  return {
    found: Boolean(title),
    headline: title ? title.textContent.replace(/\\s+/g, " ").trim() : null,
    onAir,
    window,
    countdown,
  };
})()`;

/* ------------------------------------------------------------------ *
 * The check
 * ------------------------------------------------------------------ */

const results = [];

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main() {
  await mkdir(options.out, { recursive: true });

  const [catalogue, guide] = await Promise.all([
    readCatalogue(),
    readGuide(),
  ]);

  /**
   * The channel to check: the one the guide covers whose next programme
   * starts soonest, so the check does not have to wait long for the
   * schedule to move.
   */
  const wanted = options.channel;
  let target = null;

  for (const channel of catalogue) {
    const guideChannel = guideChannelFor(guide, channel);
    if (!guideChannel) continue;
    const slots = slotsOf(guideChannel);
    if (!slotAt(slots, Date.now())) continue;
    const boundary = nextBoundary(slots, Date.now());
    if (boundary === null) continue;
    const matches =
      !wanted ||
      channel.id.toLowerCase() === wanted ||
      channel.name.toLowerCase() === wanted;
    if (!matches) continue;
    if (!target || boundary < target.boundary) {
      target = { channel, slots, boundary };
    }
  }

  if (!target) {
    throw new Error(
      wanted
        ? `no channel matches --channel=${wanted} with a programme on air`
        : "no channel with a programme on air",
    );
  }

  const { channel, slots } = target;
  const snapshot = slotAt(slots, Date.parse(guide.generatedAt));

  console.log(`channel:  ${channel.id} (${channel.name})`);
  console.log(`guide:    ${guide.date}, written ${guide.generatedAt}`);
  console.log(
    `at the file's own stamp the guide said: ${snapshot ? snapshot.title : "—"}`,
  );

  try {
    /* --- 1. the panel moves with the real clock --- */

    // The panel is answered by the server, so its proof waits for the real
    // clock to turn the minute over. It gets a browser of its own: the
    // channel page plays a stream, and a headless browser that has been
    // playing one for a few minutes is not always there when it is needed.
    if (!options.skipPanel) {
      const panelBrowser = await Browser.launch(EDGE, PANEL_CDP_PORT);
      try {
        await provePanel(panelBrowser, catalogue, guide, options);
      } finally {
        panelBrowser.close();
      }
    }

    /* --- 2. the card names the programme on air, at the real clock --- */

    // The card's browser starts here, not before the panel's proof: a
    // browser that has been sitting on an empty page for minutes is a
    // browser Chrome may have put to sleep.
    const browser = await Browser.launch(EDGE, CDP_PORT);
    try {
      await browser.navigate(options.app);
    // The page has to be alive before it can be read: a card that is not
    // hydrated yet shows the server's markup, which is the truth for the
    // moment of the render and not for the clock we are about to move.
    await waitFor(
      browser,
      `(() => {
        const input = document.querySelector('header input[type="search"]');
        if (!input) return false;
        return Object.keys(input).some((key) => key.startsWith("__react"));
      })()`,
      Date.now() + 180_000,
      500,
    );
    await sleep(2000);

    const revealed = await browser.evaluate(
      REVEAL(`[data-channel-id="${channel.id}"]`),
    );
    if (revealed?.ok) {
      console.log(
        `revealed: the card is at ${revealed.x},${revealed.y}, the point hits ${revealed.hit}`,
      );
    }

    // A reading taken right at a change could name the slot before or the
    // slot after; wait for a moment that is well inside a slot.
    let reading = await readInsideASlot(browser, slots);
    const card = await browser.evaluate(READ_CARD(channel.id));
    const hero = await browser.evaluate(READ_HERO);

    console.log(
      `now:      ${new Date(reading.moment).toISOString()} (the page's clock)`,
    );
    console.log(`on air:   ${reading.slot?.title ?? "—"}`);

    check(
      "the card is on the page",
      Boolean(card?.found),
      card?.reason ?? "",
    );
    check(
      "the card names the programme on air at the real clock",
      card?.text === reading.slot?.title,
      `the card says "${card?.text}", the guide says "${reading.slot?.title}"`,
    );
    if (snapshot && snapshot.title !== reading.slot?.title) {
      check(
        "the card does not name the programme the guide file was written at",
        card?.text !== snapshot.title,
        `the card says "${card?.text}", the file's own stamp said "${snapshot.title}"`,
      );
    }
    console.log(`hero:     ${hero?.headline ?? "—"} / on air: ${hero?.onAir ?? "—"} (${hero?.window ?? "—"})`);

    // The hero names the show that is on the channel it features. The guide
    // is asked whether any channel is airing that programme right now.
    if (hero?.onAir) {
      const airing = Object.values(guide?.channels ?? {}).some((entry) =>
        (entry?.programmes ?? []).some((programme) => {
          const start = Date.parse(programme.startsAt);
          const end = Date.parse(programme.endsAt);
          if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
          const now = Date.now();
          return (
            now >= start &&
            now < end &&
            diacritics(programme.title).trim() === hero.onAir.trim()
          );
        }),
      );
      check(
        "the hero names a programme that is on air right now",
        airing,
        `the hero says "${hero.onAir}"`,
      );
    }

    await browser.screenshot(join(options.out, "01-card.png"));

    /* --- 3. the page re-reads the guide on the minute --- */

    // The countdown in the now/next strip says how many minutes are left of
    // the programme on air. It is read off the clock, so it can only go
    // down when the page reads the clock again — which is what the minute
    // tick is for.
    const countdown = await browser.evaluate(READ_HERO);
    console.log(`countdown: ${countdown?.countdown ?? "—"} — waiting for the minute…`);
    let later = countdown;
    for (let i = 0; i < 40; i++) {
      await sleep(5000);
      later = await browser.evaluate(READ_HERO);
      if (later?.countdown && later.countdown !== countdown?.countdown) break;
    }
    const minutesOf = (text) => {
      const found = /(\d+)\s*min/.exec(String(text ?? ""));
      return found ? Number(found[1]) : null;
    };
    check(
      "the page re-reads the guide on the minute",
      minutesOf(later?.countdown) !== null &&
        minutesOf(later?.countdown) < minutesOf(countdown?.countdown),
      `the strip said "${countdown?.countdown}", a minute later it says "${later?.countdown}"`,
    );

    /* --- 4. the card moves when the clock moves --- */

    // A marker on the window: if the page is reloaded, it is gone.
    await browser.evaluate(`window.__acumProbe = "alive"; true`);

    const before = Number(await browser.evaluate("Date.now()"));
    const boundary = nextBoundary(slots, before);
    // Land thirty seconds inside the next slot, so the page's own clock and
    // the guide cannot disagree about which slot is on.
    const budget = Math.max(70_000, boundary - before + 30_000);
    console.log(
      `advancing the page's clock by ${Math.round(budget / 1000)}s, past ${new Date(boundary).toISOString()}…`,
    );

    let advanced = false;
    try {
      await browser.send("Emulation.setVirtualTimePolicy", {
        policy: "advance",
        budget,
        maxVirtualTimeTaskStarvationCount: 1000,
      });
      advanced = true;
    } catch (error) {
      console.log(`the virtual clock refused: ${error.message}`);
    }

    // The card is re-rendered by the tick, and the tick needs a moment to
    // come round under the virtual clock.
    let moved = null;
    for (let i = 0; i < 40; i++) {
      await sleep(2500);
      moved = await browser.evaluate(READ_CARD(channel.id));
      if (moved?.text && moved.text !== card?.text) break;
    }

    const alive = await browser.evaluate(`window.__acumProbe ?? null`);
    const after = Number(await browser.evaluate("Date.now()"));

    check(
      "the page was not reloaded",
      alive === "alive",
      `the marker is ${alive === "alive" ? "there" : "gone"}`,
    );

    if (advanced && moved?.text === card?.text) {
      // The virtual clock did not move the card: wait for the real minute
      // instead, and say so.
      console.log(
        "the virtual clock did not move the card — waiting for the real one",
      );
      const wait = Math.min(120_000, Math.max(0, boundary - Date.now()) + 5000);
      console.log(`waiting ${Math.round(wait / 1000)}s…`);
      await sleep(wait);
      moved = await browser.evaluate(READ_CARD(channel.id));
    }

    const expected = slotAt(slots, Number(await browser.evaluate("Date.now()")));
    console.log(`page now: ${new Date(after).toISOString()}`);
    check(
      "the card moved with the clock",
      Boolean(moved?.found) && moved.text !== card?.text,
      `it said "${card?.text}", now it says "${moved?.text}"`,
    );
    check(
      "the card names the programme that is on now",
      moved?.text === expected?.title,
      `the card says "${moved?.text}", the guide says "${expected?.title}"`,
    );

    await browser.screenshot(join(options.out, "02-card-after.png"));

    const report = {
      checkedAt: new Date().toISOString(),
      app: options.app,
      channel: { id: channel.id, name: channel.name },
      guide: { date: guide.date, generatedAt: guide.generatedAt },
      results,
    };
    await writeFile(
      join(options.out, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    } finally {
      browser.close();
    }
  } finally {
    /* the panel's browser is closed where it was opened */
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("failed:");
    for (const result of failed) {
      console.log(`  - ${result.name}: ${result.detail}`);
    }
    process.exitCode = 1;
  }
}

/**
 * A moment that is well inside a slot, as the page's own clock sees it.
 *
 * The page's clock is asked, because that is the clock the app reads.
 */
async function readInsideASlot(browser, slots) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const moment = Number(await browser.evaluate("Date.now()"));
    const { slot, margin } = marginOf(slots, moment);
    if (slot && margin > 10_000) return { moment, slot };
    await sleep(8_000);
  }
  const moment = Number(await browser.evaluate("Date.now()"));
  return { moment, slot: slotAt(slots, moment) };
}

/**
 * The panel's proof.
 *
 * The panel prints what the server answers, and the server reads the
 * clock, so the proof has three parts: the panel names the programme that
 * is on air now, the panel asks the server again on the minute, and the
 * answer changes at the changeover.
 */
async function provePanel(browser, catalogue, guide, options) {
  // The proof waits for a changeover, so it takes the channel whose
  // schedule turns over first.
  const panel = soonest(catalogue, guide);
  if (!panel) {
    console.log("SKIP  the panel — no channel changes soon enough");
    return;
  }

  const panelChannel = panel.channel;
  const sheet = `/api/channel/${encodeURIComponent(panelChannel.id)}`;
  const panelUrl = `${options.app.replace(/\/$/, "")}/canal/${encodeURIComponent(panelChannel.id)}`;

  await browser.navigate(panelUrl);
  await waitFor(
    browser,
    `(() => {
      const node = document.querySelector('[data-slot="channel-panel"]');
      if (!node) return false;
      return [...node.querySelectorAll("p,span")].some(
        (child) => child.textContent.trim() === "Acum",
      );
    })()`,
    Date.now() + 60_000,
    500,
  );

  const before = await browser.evaluate(READ_PANEL);
  const onAir = slotAt(panel.slots, Date.now());
  console.log(`panel:    ${panelChannel.name} — ${before?.text ?? "—"}`);

  check(
    "the panel is on the page",
    Boolean(before?.found),
    before?.reason ?? "",
  );
  check(
    "the panel names the programme on air at the real clock",
    before?.text === onAir?.title,
    `the panel says "${before?.text}", the guide says "${onAir?.title}"`,
  );

  // The panel asks the server again on the minute tick. Counting the
  // requests is the proof that it does.
  const asked = browser.countRequests(sheet);
  console.log("waiting 75s for the panel to ask again…");
  await sleep(75_000);
  const askedAgain = browser.countRequests(sheet);
  check(
    "the panel asks the server again on the minute",
    askedAgain > asked,
    `${asked} request(s) when it opened, ${askedAgain} after 75 seconds`,
  );

  // The answer the panel prints comes from the server, and the server reads
  // the clock. The endpoint is asked directly, so the changeover can be
  // watched without the browser in the way.
  const first = await readSheet(options.app, panelChannel.id);
  const boundary = nextBoundary(panel.slots, Date.now());
  const wait = Math.max(0, boundary - Date.now()) + 5000;
  if (wait > 240_000) {
    console.log(
      `SKIP  the answer changes at ${new Date(boundary).toISOString()} — ${Math.round(wait / 1000)}s away, too long to wait`,
    );
  } else {
    console.log(`waiting ${Math.round(wait / 1000)}s for the changeover…`);
    await sleep(wait);
    const second = await readSheet(options.app, panelChannel.id);
    check(
      "the answer the panel prints follows the clock",
      Boolean(second?.now) && second.now.title !== first?.now?.title,
      `it said "${first?.now?.title ?? "—"}", now it says "${second?.now?.title ?? "—"}"`,
    );

    // And the panel on the page says the same thing.
    const after = await browser.evaluate(READ_PANEL).catch(() => null);
    if (after?.found) {
      check(
        "the panel moved with the real clock",
        after.text !== before?.text,
        `it said "${before?.text}", now it says "${after?.text}"`,
      );
    } else {
      console.log(
        "NOTE  the page was gone by the changeover — the answer itself was watched instead",
      );
    }
  }

  await browser
    .screenshot(join(options.out, "03-panel.png"))
    .catch(() => console.log("NOTE  the page was gone — no screenshot"));
}

/**
 * The channel sheet, asked for over the wire.
 *
 * The panel prints what the server answers, and the server reads the
 * clock. Asking the endpoint directly watches the answer move without the
 * browser in the way.
 */
async function readSheet(app, id) {
  const response = await fetch(
    `${app.replace(/\/$/, "")}/api/channel/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  return await response.json();
}

/** Poll a snippet until it answers something truthy. */
async function waitFor(browser, expression, deadline, step = 400) {
  for (;;) {
    const value = await browser.evaluate(expression).catch(() => null);
    if (value) return value;
    if (Date.now() > deadline) return null;
    await sleep(step);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
