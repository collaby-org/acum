/**
 * Stream plumbing shared by the player routes.
 *
 * Server-side only — it reaches for `node:crypto` to sign the proxy tokens
 * that the browser hands back to `/api/stream`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { UpstreamChannel, UpstreamServer } from "@/data/types";

/**
 * The upstream media hosts answer with a 300 kB HTML cloaking page unless the
 * request carries a Referer they recognise — their own origin, the page that
 * embeds them, or the site that publishes them. A browser cannot set one, so
 * every byte of the stream has to travel through our own proxy.
 */
export const UPSTREAM_REFERER = "https://canale-tv.net/";

/** The site that publishes the upstream feeds; the second fallback. */
export const PUBLISHER_REFERER = "https://www.cool-etv.net/";

/** A browser-ish UA; the upstream player pages answer with a wall otherwise. */
export const UPSTREAM_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

/** Hosts that serve the upstream player pages whose obfuscation we can read. */
export const PLAYER_HOSTS = ["canale-tv.net", "canale-tv.com"];

/** Hosts whose player page may be framed as a last resort. */
export const EMBED_HOSTS = [
  "canale-tv.net",
  "canale-tv.com",
  "www.youtube.com",
  "youtube.com",
];

/** The site that publishes the channel pages; the last-resort frame. */
export const SOURCE_HOSTS = ["www.cool-etv.net", "cool-etv.net"];

/** Ad and tracker hosts that must never reach the browser. */
export const AD_HOSTS = [
  "acscdn.com",
  "adexchangerapid.com",
  "usrpubtrk.com",
  "googletagmanager.com",
  "google-analytics.com",
  "doubleclick.net",
  "adsterra.com",
  "popads.net",
  "propellerads.com",
];

/**
 * The second source: the directory that publishes the channel list, and the
 * media hosts its streams come from. Both are named outright rather than
 * opened by suffix — `rd.` is the panel's own host, `tv.` the one that
 * serves the playlists.
 */
export const SECONDARY_HOSTS = [
  "canaletvlive.online",
  "tv.playitforme.online",
  "rd.playitforme.online",
];

/** The Referer the second source's media host accepts. */
export const SECONDARY_REFERER = "https://canaletvlive.online/";

/** Host suffixes the media proxy is allowed to pull bytes from. */
export const MEDIA_HOST_SUFFIXES = [
  ".cfd",
  ".shop",
  ".live",
  ".top",
  ".xyz",
  ".site",
  ".io",
  ".tv",
  ".cc",
  ".pw",
  ".stream",
];

/** How long a proxy token stays usable. */
const TOKEN_TTL_SECONDS = 60 * 60 * 6;

/** Signs the proxy tokens. Server-side only; never shipped to the browser. */
const TOKEN_SECRET = "acum-stream-proxy-v1";

/* ------------------------------------------------------------------ *
 * URL policy
 * ------------------------------------------------------------------ */

/** True for an upstream player page we are allowed to read. */
export function isAllowedPlayerUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      PLAYER_HOSTS.includes(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

/** True for a media URL the proxy is allowed to fetch. */
export function isAllowedMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (SECONDARY_HOSTS.includes(host)) return true;
    return MEDIA_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

/** True for a player page we are allowed to frame as a last resort. */
export function isAllowedEmbedUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (EMBED_HOSTS.includes(host)) return true;
    return MEDIA_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

/**
 * True for an upstream page we can read and try to resolve.
 *
 * That is the player pages on canale-tv.net and the panels on the `.cfd` and
 * `.shop` hosts — all of them hide their playlist behind the same
 * obfuscation.
 */
export function isResolvablePageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (PLAYER_HOSTS.includes(host)) return true;
    return MEDIA_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

/** True for the channel page on the site that publishes the feeds. */
export function isAllowedSourceUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return SOURCE_HOSTS.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * The Referers an upstream host accepts, best first.
 *
 * The host's own origin first — that is what the upstream player itself
 * sends — then the page that publishes the feeds, then the site the player
 * pages live on.
 */
export function refererChain(url: string): string[] {
  const chain: string[] = [];
  try {
    chain.push(`${new URL(url).origin}/`);
  } catch {
    /* the caller already validated the URL */
  }
  chain.push(UPSTREAM_REFERER, PUBLISHER_REFERER, SECONDARY_REFERER);
  return [...new Set(chain)];
}

/**
 * The Referer that worked for a host, remembered for the life of the process.
 *
 * A host answers with a redirect to Google unless it recognises the
 * Referer, and the answer is the same for the manifest, the variant and the
 * segments — they all live on the same host. Remembering the winner turns
 * every request after the first into a single fetch.
 */
const refererCache = new Map<string, string>();

/** How many hosts to remember before the oldest one is dropped. */
const REFERER_CACHE_LIMIT = 128;

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

function rememberReferer(host: string, referer: string): void {
  if (!host || refererCache.get(host) === referer) return;
  if (refererCache.size >= REFERER_CACHE_LIMIT) {
    const oldest = refererCache.keys().next().value;
    if (oldest !== undefined) refererCache.delete(oldest);
  }
  refererCache.set(host, referer);
}

/**
 * The Referers to try for a URL, the one that worked last time first.
 */
function orderedReferers(url: string): string[] {
  const chain = refererChain(url);
  const cached = refererCache.get(hostOf(url));
  if (!cached) return chain;
  return [cached, ...chain.filter((referer) => referer !== cached)];
}

/** True when the upstream sent us to Google instead of the bytes. */
function isGoogleRedirect(url: string): boolean {
  return url.includes("google.com");
}

/** Resolve a playlist-relative URI against the playlist it came from. */
export function absolutize(uri: string, baseUrl: string): string {
  try {
    return new URL(uri, baseUrl).toString();
  } catch {
    return uri;
  }
}

/**
 * The address of a stream, in ASCII.
 *
 * Some of the upstream hosts are spelled in Unicode — `kuruk1.乼亶.shop`
 * rather than `kuruk1.xn--okq6e.shop`. A browser and the URL parser both
 * understand it, but a signature computed over one spelling does not match
 * the other, and a host name that looks like mojibake in a log is a host
 * name nobody can read. The URL parser does the conversion; this is only
 * here to make sure it happens.
 */
export function asciiUrl(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ *
 * Playlists
 * ------------------------------------------------------------------ */

/**
 * True when the body is an HLS playlist.
 *
 * The upstream serves playlists as `text/html` with a `.htm` extension, so
 * neither the MIME type nor the file name can be trusted — only the body.
 */
export function isPlaylist(body: string): boolean {
  return body.trimStart().startsWith("#EXTM3U");
}

/**
 * Point every URI in a playlist at our own proxy.
 *
 * Handles both bare segment lines and the `URI="..."` attribute carried by
 * `#EXT-X-KEY`, `#EXT-X-MAP` and friends.
 *
 * `extra` is appended to every rewritten address. It is how the channel and
 * the viewer travel with each segment request, so the proxy can count who is
 * watching what without the browser ever holding an upstream address.
 */
export function rewritePlaylist(
  body: string,
  baseUrl: string,
  toProxy: (absoluteUrl: string) => string,
  extra?: Record<string, string>,
): string {
  const suffix = extra
    ? Object.entries(extra)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&")
    : "";

  const withExtra = (url: string) => {
    const base = toProxy(url);
    if (!suffix) return base;
    return base.includes("?") ? `${base}&${suffix}` : `${base}?${suffix}`;
  };

  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(
          /URI="([^"]*)"/g,
          (_match, uri: string) => `URI="${withExtra(absolutize(uri, baseUrl))}"`,
        );
      }
      return withExtra(absolutize(trimmed, baseUrl));
    })
    .join("\n");
}

/* ------------------------------------------------------------------ *
 * Proxy tokens
 * ------------------------------------------------------------------ */

function sign(payload: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
}

/**
 * Wrap an upstream URL into an opaque, signed token.
 *
 * The browser only ever sees `/api/stream?t=…`, so the upstream hosts stay
 * invisible to it and the proxy cannot be pointed at an arbitrary address.
 *
 * The token also carries the **channel** the address belongs to. That is
 * what lets the proxy count the audience per channel: the segment requests
 * arrive without a name, and the name is signed into the address they came
 * from.
 */
export function signStreamToken(
  url: string,
  channelId?: string,
  ttlSeconds = TOKEN_TTL_SECONDS,
): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = Buffer.from(
    `${expires}:${channelId ?? ""}:${url}`,
    "utf8",
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** What a token stands for. */
export type StreamToken = {
  /** The upstream address, still on the server. */
  url: string;
  /** The channel the address belongs to, when the token carries one. */
  channelId: string | null;
};

/** Unwrap a token back into the upstream URL, or null when it is not ours. */
export function readStreamToken(token: string): StreamToken | null {
  const separator = token.indexOf(".");
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const firstColon = decoded.indexOf(":");
  if (firstColon <= 0) return null;

  const expires = Number(decoded.slice(0, firstColon));
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return null;

  const rest = decoded.slice(firstColon + 1);
  const secondColon = rest.indexOf(":");
  // A token written before the channel was carried still opens: the
  // address is what matters, and the channel is only used for the count.
  const channelId = secondColon > 0 ? rest.slice(0, secondColon) : "";
  const url = secondColon > 0 ? rest.slice(secondColon + 1) : rest;

  if (!isAllowedMediaUrl(url)) return null;
  return { url, channelId: channelId || null };
}

/* ------------------------------------------------------------------ *
 * Sanitising an upstream player page
 * ------------------------------------------------------------------ */

function isAdUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return AD_HOSTS.some((host) => lower.includes(host));
}

/**
 * Presses the upstream poster and closes the escape hatch it leaves open.
 *
 * The upstream shows a "click to play" poster and only then computes the
 * playlist. Pressing it here is what turns two clicks into one. The player
 * pages name the poster `#click-to-play`; the panels paint theirs as a
 * background image, so those get a generic sweep as well.
 */
const AUTO_PLAY_SCRIPT = `<script>(function(){
  function press(el){
    try { el.click(); } catch (e) {}
    try {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (e) {}
  }
  function find(){
    var el = document.getElementById('click-to-play');
    if (el) return el;
    var all = document.querySelectorAll('img, div, span, button');
    for (var i = 0; i < all.length; i++) {
      var style = null;
      try { style = window.getComputedStyle(all[i]); } catch (e) {}
      if (!style) continue;
      var art = (style.backgroundImage || '') + ' ' + (all[i].getAttribute('src') || '');
      if (/\\.(jpg|jpeg|png|webp)/i.test(art)) return all[i];
    }
    return null;
  }
  var tries = 0;
  function attempt(){
    var el = find();
    if (el) { press(el); return; }
    if (tries++ < 80) setTimeout(attempt, 250);
  }
  try { window.open = function(){ return null; }; } catch (e) {}
  if (document.readyState === 'complete') attempt();
  else window.addEventListener('load', attempt);
})();</script>`;

/**
 * Sends the upstream's own player through our proxy.
 *
 * Served from our origin, the page would fetch its playlist with our
 * Referer, which the media hosts refuse. This puts the proxy in front of
 * every playlist URL the page asks for.
 */
const STREAM_REWRITER = `<script>(function(){
  function rewrite(url){
    if (typeof url !== 'string') return url;
    if (!/\\.m3u8/i.test(url)) return url;
    if (url.indexOf('/api/stream') === 0) return url;
    return '/api/stream?u=' + encodeURIComponent(url);
  }
  try {
    if (window.Hls && window.Hls.prototype) {
      var loadSource = window.Hls.prototype.loadSource;
      window.Hls.prototype.loadSource = function(url, ctx){ return loadSource.call(this, rewrite(url), ctx); };
    }
  } catch (e) {}
  try {
    var desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (desc && desc.set) {
      Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        get: desc.get,
        set: function(value){ desc.set.call(this, rewrite(value)); },
        configurable: true,
      });
    }
  } catch (e) {}
})();</script>`;

/**
 * Strip the ad scripts and the trackers out of an upstream player page.
 *
 * The page is served from our own origin with a sandboxed content-security
 * policy, so the ad script that opens a new window never runs and the
 * trackers never see the visitor.
 */
export function sanitizeUpstreamPage(html: string, baseUrl: string): string {
  let out = html;

  // Every script that loads from an ad or tracker host goes away.
  out = out.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi,
    (match, src: string) => (isAdUrl(src) ? "" : match),
  );

  // So does the inline call that opens the ad window, and the analytics one.
  out = out.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (match, _attributes: string, body: string) =>
      /aclib|runPop|gtag\s*\(|dataLayer|googletagmanager|google-analytics/i.test(
        body,
      )
        ? ""
        : match,
  );

  // A base tag, so the relative assets still resolve against the upstream.
  out = out.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}">`);

  // Our helpers go last, after the upstream's own scripts.
  out = out.replace(
    /<\/body>/i,
    `${STREAM_REWRITER}${AUTO_PLAY_SCRIPT}</body>`,
  );

  return out;
}

/* ------------------------------------------------------------------ *
 * Talking to the upstream
 * ------------------------------------------------------------------ */

/** Fetch an upstream player page. Returns null when it cannot be read. */
export async function fetchPlayerPage(url: string): Promise<string | null> {
  for (const referer of orderedReferers(url)) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": UPSTREAM_USER_AGENT,
          referer,
          accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) continue;
      // A host that does not know our Referer sends us to Google.
      if (isGoogleRedirect(response.url)) continue;
      const body = await response.text();
      if (!body.includes("cat1")) continue;
      rememberReferer(hostOf(url), referer);
      return body;
    } catch {
      /* try the next Referer */
    }
  }
  return null;
}

/** Fetch an upstream player page for framing. No obfuscation needed. */
export async function fetchEmbedPage(url: string): Promise<string | null> {
  for (const referer of orderedReferers(url)) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": UPSTREAM_USER_AGENT,
          referer,
          accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) continue;
      if (isGoogleRedirect(response.url)) continue;
      const body = await response.text();
      if (!body.trimStart().startsWith("<")) continue;
      rememberReferer(hostOf(url), referer);
      return body;
    } catch {
      /* try the next Referer */
    }
  }
  return null;
}

/**
 * Peek at the first bytes to tell a playlist from a media segment.
 *
 * The upstream serves both as `text/html`, and the media playlist is even
 * named `…-got.htm`, so neither the MIME type nor the extension is usable.
 */
async function splitFirstChunk(body: ReadableStream<Uint8Array>): Promise<{
  head: Uint8Array;
  rest: ReadableStream<Uint8Array>;
}> {
  const reader = body.getReader();
  const first = await reader.read();
  const head = first.done ? new Uint8Array() : first.value;

  const rest = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!first.done) controller.enqueue(head);
    },
    async pull(controller) {
      const next = await reader.read();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(next.value);
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });

  return { head, rest };
}

export type UpstreamStream = {
  head: Uint8Array;
  rest: ReadableStream<Uint8Array>;
  referer: string;
};

/**
 * Open an upstream URL with the first Referer the host accepts.
 *
 * The manifest, the variant playlist and the segments all live on the same
 * host and are gated the same way, so the winner is remembered per host:
 * after the first fetch every segment costs a single request.
 */
export async function openUpstream(url: string): Promise<UpstreamStream | null> {
  for (const referer of orderedReferers(url)) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "user-agent": UPSTREAM_USER_AGENT,
          referer,
        },
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      continue;
    }

    if (!response.ok || !response.body) continue;
    if (isGoogleRedirect(response.url)) continue;

    const { head, rest } = await splitFirstChunk(response.body);
    const probe = new TextDecoder().decode(head.slice(0, 32)).trimStart();
    // The cloaking page is HTML; a playlist starts with #EXTM3U and a
    // segment starts with the MPEG-TS sync byte.
    if (probe.startsWith("<")) continue;

    rememberReferer(hostOf(url), referer);
    return { head, rest, referer };
  }

  return null;
}

/**
 * True when the URL answers with a real playlist.
 *
 * Every Referer the host accepts is tried, not just one: the second
 * source's media host only answers to its own directory, and a feed that
 * plays perfectly well would be called broken otherwise.
 */
export async function probePlaylist(url: string): Promise<boolean> {
  for (const referer of orderedReferers(url)) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": UPSTREAM_USER_AGENT,
          referer,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) continue;
      if (isPlaylist(await response.text())) return true;
    } catch {
      /* try the next Referer */
    }
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Server selection
 * ------------------------------------------------------------------ */

/**
 * The upstream feeds of a channel, ordered by how likely they are to play.
 *
 * A feed with a playlist already resolved comes first; then the feeds whose
 * page we know how to read, live ones before unknown ones; the rest last.
 */
export function pickServer(channel: UpstreamChannel): UpstreamServer[] {
  const usable = channel.servers.filter(
    (server) =>
      server.hlsUrl !== null ||
      server.source === "secondary" ||
      (server.embedUrl !== null &&
        server.kind !== "acestream" &&
        server.kind !== "none"),
  );

  const rank = (server: UpstreamServer): number => {
    if (server.hlsUrl) return 0;
    if (server.source === "secondary") return 1;
    if (isAllowedPlayerUrl(server.embedUrl)) return server.status === "live" ? 2 : 4;
    return server.status === "live" ? 3 : 5;
  };

  return [...usable].sort((a, b) => rank(a) - rank(b));
}

/* ------------------------------------------------------------------ *
 * Reading the upstream player page
 *
 * The upstream obfuscates its player page with three nested string
 * transforms. None of them needs to be executed: each one is a seeded
 * transposition, and the two decoders between them are plain source that
 * we can lift out of the page and re-implement.
 * ------------------------------------------------------------------ */

type TransposeConfig = {
  seed: number;
  k1: number;
  m1: number;
  k2: number;
  m2: number;
  mod: number;
};

/** Return the text between the braces that start at `openIndex`. */
function scanBlock(source: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return "";
}

/** Turn a JavaScript string literal into the string it stands for. */
function decodeJsString(raw: string): string {
  return raw.replace(
    /\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r\n|[\s\S])/g,
    (_match, escape: string) => {
      switch (escape) {
        case "n":
          return "\n";
        case "t":
          return "\t";
        case "r":
          return "\r";
        case "b":
          return "\b";
        case "f":
          return "\f";
        case "v":
          return "\v";
        case "0":
          return "\0";
        case "\n":
          return "";
        default:
          break;
      }
      if (escape[0] === "u") {
        const hex = escape[1] === "{" ? escape.slice(2, -1) : escape.slice(1);
        return String.fromCodePoint(Number.parseInt(hex, 16));
      }
      if (escape[0] === "x") {
        return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
      }
      return escape;
    },
  );
}

/** Lift the numeric constants out of a seeded transposition. */
function parseTransposeConfig(body: string): TransposeConfig | null {
  const seed = /var\s+\w+=(\d+);var\s+\w+=\w+\.length;/.exec(body);
  if (!seed) return null;

  const multipliers = [
    ...body.matchAll(/\w+\*\(\w+\+(\d+)\)\+\(\w+%(\d+)\)/g),
  ].map((match) => ({ k: Number(match[1]), mod: Number(match[2]) }));
  if (multipliers.length < 2) return null;

  const modulus = /=\(\w+\+\w+\)%(\d+)/.exec(body);
  if (!modulus) return null;

  return {
    seed: Number(seed[1]),
    k1: multipliers[0].k,
    m1: multipliers[0].mod,
    k2: multipliers[1].k,
    m2: multipliers[1].mod,
    mod: Number(modulus[1]),
  };
}

/** The transposition itself: a seeded shuffle of the characters. */
function applyTranspose(input: string, config: TransposeConfig): string {
  const length = input.length;
  const chars = [...input];
  let seed = config.seed;
  for (let i = 0; i < length; i++) {
    const a = seed * (i + config.k1) + (seed % config.m1);
    const b = seed * (i + config.k2) + (seed % config.m2);
    const from = a % length;
    const to = b % length;
    const swap = chars[from];
    chars[from] = chars[to];
    chars[to] = swap;
    seed = (a + b) % config.mod;
  }
  return chars.join("");
}

/**
 * The middle layer: a decoder that reads back the text the outer layer hid.
 *
 * Its body is lifted verbatim from the page, so every constant it uses is
 * read from the page too instead of being assumed.
 */
function buildDecoder(source: string): ((input: string) => string) | null {
  const offsets = /var\s+\w+=(\d+),\w+=(\d+),\w+=(\d+);/.exec(source);
  const keyArray = /var\s+\w+=(\[[\d,\s]*\]);/.exec(source);
  const increments = /(\w+)\+=(\d+);(\w+)\+=(\d+);(\w+)\+=(\d+);/.exec(source);
  const alphabet = /var\s+\w+=("[^"]*");/.exec(source);
  const prefixArray = /var\s+\w+=(\[[\d,\s]*\])\.concat\(/.exec(source);
  if (!offsets || !keyArray || !increments) return null;

  const numbers = (literal: string): number[] =>
    literal
      .slice(1, -1)
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value));

  const keys = numbers(keyArray[1]);
  const y = Number(offsets[1]) + Number(increments[2]);
  const z = Number(offsets[2]) + Number(increments[4]);
  const n = Number(offsets[3]) + Number(increments[6]);

  const lookup = new Array<number>(256).fill(0);
  for (let i = 0; i < keys.length; i++) lookup[keys[i]] = i + 1;

  const letters = alphabet ? (JSON.parse(alphabet[1]) as string) : "abcdefghijklmnopqrstuvwxyz";
  const escapes = prefixArray ? numbers(prefixArray[1]) : [96, 92, 32, 10, 42, 39];
  const table = escapes.concat(keys);
  const dot = ".";

  return (input: string): string => {
    const words = input.split(" ");
    const decoded: string[] = [];

    for (let index = words.length - 1; index >= 0; index--) {
      const word = words[index];
      let pieces: string[] | null = null;
      let cursor = 0;
      let position = 0;

      for (let offset = 0; offset < word.length; offset++) {
        const code = word.charCodeAt(offset);
        const rank = lookup[code];
        let jump: number;

        if (rank) {
          jump = (rank - 1) * z + word.charCodeAt(offset + 1) - y;
          position = offset;
          offset++;
        } else if (code === n) {
          jump =
            z * (keys.length - y + word.charCodeAt(offset + 1)) +
            word.charCodeAt(offset + 2) -
            y;
          position = offset;
          offset += 2;
        } else {
          continue;
        }

        if (pieces === null) pieces = [];
        if (position > cursor) pieces.push(word.substring(cursor, position));
        pieces.push(words[jump + 1]);
        cursor = offset + 1;
      }

      if (pieces !== null) {
        if (cursor < word.length) pieces.push(word.substring(cursor));
        words[index] = pieces.join("");
      }
    }

    decoded.push(words[0]);

    let output = decoded.join("");
    for (let i = 0; i < table.length; i++) {
      output = output
        .split(dot + letters.charAt(i))
        .join(String.fromCharCode(table[i]));
    }
    return output.split(dot + "!").join(dot);
  };
}

/** The innermost layer: a second transposition plus a few marker swaps. */
function readInnerSource(source: string): { payload: string; seed: number } | null {
  const call = /\)\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*(\d+)\s*\)/.exec(source);
  if (!call) return null;
  return { payload: decodeJsString(call[1]), seed: Number(call[2]) };
}

/** Escape a name so it can be used inside a pattern. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The one-line helpers the innermost layer routes its arithmetic through.
 *
 * The layer used to inline the arithmetic (`b * (v + 164) + (b % 43292)`).
 * It now calls generated helpers instead — `function x(a,b){return a% b}` and
 * `function y(a,b){return a+ b}` — so the constants can only be read once
 * the helper names are known.
 */
type Arithmetic = { mod: string | null; add: string | null };

function readArithmetic(source: string): Arithmetic {
  const mod =
    /function\s+([\w$]+)\s*\(\s*[\w$]+\s*,\s*[\w$]+\s*\)\s*\{\s*return\s+[\w$]+\s*%\s*[\w$]+\s*;?\s*\}/.exec(
      source,
    );
  const add =
    /function\s+([\w$]+)\s*\(\s*[\w$]+\s*,\s*[\w$]+\s*\)\s*\{\s*return\s+[\w$]+\s*\+\s*[\w$]+\s*;?\s*\}/.exec(
      source,
    );
  return { mod: mod?.[1] ?? null, add: add?.[1] ?? null };
}

/**
 * The constants of the innermost transposition, in both of the shapes the
 * upstream uses.
 *
 * Inlined — `b * (v + 164) + (b % 43292)`, with the seed carried on as
 * `b = (j + t) % 5102270`.
 *
 * Through helpers — `add(seed * (add(i, 164)), mod(seed, 43292))`, with the
 * seed carried on as `seed = mod((add(a, b)), 5102270)`.
 */
function readInnerConfig(source: string): TransposeConfig | null {
  const inlined = [
    ...source.matchAll(/\*\s*\(\s*\w+\s*\+\s*(\d+)\s*\)\s*\+\s*\(\s*\w+\s*%\s*(\d+)\s*\)/g),
  ].map((match) => ({ k: Number(match[1]), mod: Number(match[2]) }));
  const inlinedModulus = /=\s*\(\s*\w+\s*\+\s*\w+\s*\)\s*%\s*(\d+)/.exec(source);
  if (inlined.length >= 2 && inlinedModulus) {
    return {
      seed: 0,
      k1: inlined[0].k,
      m1: inlined[0].mod,
      k2: inlined[1].k,
      m2: inlined[1].mod,
      mod: Number(inlinedModulus[1]),
    };
  }

  const { mod, add } = readArithmetic(source);
  if (!mod || !add) return null;
  const modName = escapeRegExp(mod);
  const addName = escapeRegExp(add);

  const throughHelpers = [
    ...source.matchAll(
      new RegExp(
        `${addName}\\(\\s*[\\w$.]*\\s*\\*\\s*\\(\\s*${addName}\\(\\s*[\\w$.]*\\s*,\\s*(\\d+)\\s*\\)\\s*\\)\\s*,\\s*\\(\\s*${modName}\\(\\s*[\\w$.]*\\s*,\\s*(\\d+)\\s*\\)`,
        "g",
      ),
    ),
  ].map((match) => ({ k: Number(match[1]), mod: Number(match[2]) }));
  if (throughHelpers.length < 2) return null;

  const modulus = new RegExp(
    `${modName}\\(\\s*\\(\\s*${addName}\\(\\s*[\\w$.]*\\s*,\\s*[\\w$.]*\\s*\\)\\s*\\)\\s*,\\s*(\\d+)\\s*\\)`,
  ).exec(source);
  if (!modulus) return null;

  return {
    seed: 0,
    k1: throughHelpers[0].k,
    m1: throughHelpers[0].mod,
    k2: throughHelpers[1].k,
    m2: throughHelpers[1].mod,
    mod: Number(modulus[1]),
  };
}

/**
 * Read the playlist URLs out of an upstream player page.
 *
 * Returns them in the order the upstream lists them — the first one is the
 * one its own player uses, the others are mirrors.
 */
export function resolveStreamUrls(html: string): string[] {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => match[2].trim().length > 0)
    .map((match) => match[2]);

  const page = scripts.find((script) => script.includes("cat1"));
  if (!page) return [];

  const start = page.indexOf("var cat1");
  if (start < 0) return [];
  const region = page.slice(start);

  const shuffle = /function\s+(\w+)\s*\(([^)]*)\)\s*\{/.exec(region);
  if (!shuffle) return [];

  const open = region.indexOf("{", shuffle.index + shuffle[0].length - 1);
  const shuffleConfig = parseTransposeConfig(scanBlock(region, open));
  if (!shuffleConfig) return [];

  const decoderCall = new RegExp(
    `(\\w+)=(\\w+)\\(\\s*\\w*\\s*,\\s*${shuffle[1]}\\(\\s*(\\w+)\\s*\\)\\s*\\)`,
  ).exec(region);
  if (!decoderCall) return [];

  const decoderPayload = new RegExp(`\\b${decoderCall[3]}\\s*=\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(
    region,
  );
  if (!decoderPayload) return [];

  const decoder = buildDecoder(applyTranspose(decodeJsString(decoderPayload[1]), shuffleConfig));
  if (!decoder) return [];

  const streamCall = new RegExp(
    `(\\w+)=(\\w+)\\(\\s*${shuffle[1]}\\(\\s*'((?:[^'\\\\]|\\\\.)*)'\\s*\\)\\s*\\)`,
  ).exec(region);
  if (!streamCall) return [];

  const innerSource = decoder(applyTranspose(decodeJsString(streamCall[3]), shuffleConfig));
  const inner = readInnerSource(innerSource);
  const innerConfig = readInnerConfig(innerSource);
  if (!inner || !innerConfig) return [];

  const separator = String.fromCharCode(127);
  const decoded = applyTranspose(inner.payload, { ...innerConfig, seed: inner.seed })
    .split("%")
    .join(separator)
    .split("#1")
    .join("%")
    .split("#0")
    .join("#")
    .split(separator);

  const urls: string[] = [];
  for (const candidate of decoded) {
    const url = asciiUrl(candidate.trim());
    if (url.startsWith("http") && !urls.includes(url)) urls.push(url);
  }
  return urls;
}
