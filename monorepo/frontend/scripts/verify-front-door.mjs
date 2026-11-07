/**
 * The front door.
 *
 * What the owner reports: opening the app on a fresh boot sends the visitor
 * to `/conturi` first. It must never happen — the catalogue is the home of
 * the app, on the web, on a phone and in the installed PWA.
 *
 * The harness asks the deployed site the question directly, in three states
 * a real device is in:
 *
 *   1. a fresh session cookie — the visitor signed in an hour ago;
 *   2. a stale session cookie — the access token expired while the browser
 *      was closed, and the refresh token (which the browser owns) is still
 *      good;
 *   3. no cookie at all — the browser holds the session, the server has not
 *      heard of it yet.
 *
 * Every navigation the browser makes is printed, and the harness fails if
 * `/conturi` appears anywhere in the chain, or if a signed-in visitor does
 * not end up on `/canale`.
 *
 *   node scripts/verify-front-door.mjs https://acum-weld.vercel.app/
 *
 * The credentials come from the environment (ACUM_HARNESS_EMAIL,
 * ACUM_HARNESS_PASSWORD and the Supabase pair); nothing secret is printed
 * and nothing is written outside the system temporary directory.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { installSession } from "./harness-signin.mjs";

const APP = (
  process.argv[2] ?? "https://acum-weld.vercel.app/"
).replace(/\/$/, "");
const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9361;
const OUT = resolve(tmpdir(), "acum-verify-front-door");

/** How long the browser may take to settle on its final address. */
const SETTLE_MS = 10_000;

/** The cookie the browser mirrors its access token into. */
const COOKIE = "acum-session";

/** Base64url, the way `session-token.ts` encodes the mirror. */
function encodeCookie(accessToken) {
  const bytes = new TextEncoder().encode(JSON.stringify({ access_token: accessToken }));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The same token, with its expiry in the past — the overnight state. */
function staleToken(accessToken) {
  const [head, body, tail] = accessToken.split(".");
  if (!head || !body || !tail) return accessToken;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    claims.exp = Math.floor(Date.now() / 1000) - 60;
    const encoded = Buffer.from(JSON.stringify(claims), "utf8")
      .toString("base64url")
      .replace(/=+$/, "");
    return `${head}.${encoded}.${tail}`;
  } catch {
    return accessToken;
  }
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const edge = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${OUT}\\.profile`,
  "--disable-gpu",
  "--no-first-run",
  "--window-size=1280,900",
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
/** The addresses the browser visited, in order. */
let chain = [];

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === "Page.frameNavigated" && msg.params?.frame?.parentId === undefined) {
    chain.push(msg.params.frame.url);
  }
  if (msg.method === "Page.navigatedWithinDocument") {
    chain.push(msg.params.url);
  }
  if (
    msg.method === "Network.requestWillBeSent" &&
    msg.params?.redirectResponse
  ) {
    chain.push(`${msg.params.redirectResponse.status} ${msg.params.request.url}`);
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
const accessToken = await installSession(send);

const checks = [];
const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ *
 * The server, asked directly
 * ------------------------------------------------------------------ */

const freshCookie = `${COOKIE}=${encodeCookie(accessToken)}`;

const door = await fetch(`${APP}/`, {
  headers: { cookie: freshCookie },
  redirect: "manual",
});
const doorLocation = door.headers.get("location") ?? "";
record(
  "the front door sends a signed-in visitor to the catalogue",
  door.status === 307 && doorLocation.endsWith("/canale"),
  `${door.status} → ${doorLocation || "(no location)"}`,
);

/**
 * The overnight state, asked of the server itself.
 *
 * The browser refreshes its own session, so the visitor never notices that
 * the access token in the cookie has expired. The server has to notice it
 * too — a browser that holds a session is sent to the catalogue whether
 * that session's token is fresh or spent, because the refresh token, which
 * the browser owns, is what renews it.
 */
const staleDoor = await fetch(`${APP}/`, {
  headers: {
    cookie: `${COOKIE}=${encodeCookie(staleToken(accessToken))}`,
  },
  redirect: "manual",
});
const staleLocation = staleDoor.headers.get("location") ?? "";
record(
  "the front door sends a browser with a stale session to the catalogue",
  staleDoor.status === 307 && staleLocation.endsWith("/canale"),
  `${staleDoor.status} → ${staleLocation || "(no location)"}`,
);

const anonymousDoor = await fetch(`${APP}/`, { redirect: "manual" });
record(
  "the front door leaves a visitor without a session on the landing page",
  anonymousDoor.status === 200,
  `${anonymousDoor.status}`,
);

const anonymousCatalogue = await fetch(`${APP}/canale`, { redirect: "manual" });
record(
  "the catalogue answers an anonymous visitor instead of the accounts page",
  anonymousCatalogue.status === 200,
  `${anonymousCatalogue.status} ${anonymousCatalogue.headers.get("location") ?? ""}`,
);

/* ------------------------------------------------------------------ *
 * The browser, in the three states a device is in
 * ------------------------------------------------------------------ */

/**
 * Opens the front door and follows the visitor to where they end up.
 *
 * @param {string} label what the state is called
 * @param {"fresh" | "stale" | "none"} state which cookie the device carries
 */
async function boot(label, state) {
  chain = [];
  await send("Network.clearBrowserCookies");
  if (state !== "none") {
    const token = state === "stale" ? staleToken(accessToken) : accessToken;
    await send("Network.setCookie", {
      name: COOKIE,
      value: encodeCookie(token),
      domain: new URL(APP).hostname,
      path: "/",
      secure: true,
    });
  }

  await send("Page.navigate", { url: "about:blank" });
  await new Promise((r) => setTimeout(r, 400));
  await send("Page.navigate", { url: `${APP}/` });

  let path = "";
  const started = Date.now();
  while (Date.now() - started < SETTLE_MS) {
    await new Promise((r) => setTimeout(r, 250));
    const where = await evaluate("location.pathname");
    if (typeof where === "string" && where.length > 0) path = where;
    if (path === "/canale") break;
  }

  const visited = chain.map((entry) => {
    try {
      return new URL(entry).pathname;
    } catch {
      return entry;
    }
  });
  const accounts = visited.filter((entry) => entry.includes("/conturi"));

  console.log(`\n=== ${label} ===`);
  console.log(`final address: ${path || "(unknown)"}`);
  console.log("the chain:");
  for (const entry of chain) console.log(`  ${entry}`);

  record(
    `${label}: the accounts page never appears`,
    accounts.length === 0,
    accounts.length ? `visited ${accounts.join(", ")}` : "clean",
  );
  record(
    `${label}: the visitor ends up on the catalogue`,
    path === "/canale",
    `ended on ${path || "(unknown)"}`,
  );
}

await boot("a fresh session cookie", "fresh");
await boot("a stale session cookie (the overnight state)", "stale");
await boot("no cookie at all", "none");

const failed = checks.filter((check) => !check.pass);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed.`,
);
if (failed.length) {
  console.log("the failed checks:");
  for (const check of failed) console.log(`  FAIL  ${check.name} — ${check.detail}`);
}

ws.close();
edge.kill();
await rm(OUT, { recursive: true, force: true }).catch(() => undefined);
process.exit(failed.length ? 1 : 0);
