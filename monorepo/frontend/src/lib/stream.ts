/**
 * Stream plumbing shared by the player routes.
 *
 * Server-side only — it reaches for `node:crypto` to sign the proxy tokens
 * that the browser hands back to `/api/stream`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Quality } from "@/data/types";
import { QUALITY_META } from "@/lib/channel-meta";

/**
 * This module signs server-side stream tokens and reaches upstream hosts.
 * It must never be loaded in a browser bundle.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "Modulul de flux este server-only și nu poate fi importat în browser.",
  );
}

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

/**
 * The exact upstream media hosts used by the checked-in catalogue.
 *
 * This list is the union of the real upstream hosts in the repository's
 * stream inventories (`data/canale-tv-streams.json`, `data/resolved-streams.json`,
 * `data/embed-health.json`) and `src/data/channels.ts`. Suffixes are not
 * accepted: a shared suffix would turn the proxy into an open egress.
 * Punycode names are kept exactly as the URL parser exposes them.
 */
export const MEDIA_HOSTS = [
  "alpha1.cool-itv.com",
  "alpha1.yozefina.cfd",
  "arwen1.panaka001.cfd",
  "arwen1.panaka1.cfd",
  "atlantida1.aquax001.shop",
  "ceres1.vizionman.cfd",
  "cronos.mangora1.cfd",
  "epsilon1.visionxman1.cfd",
  "flash1.bogulus.cfd",
  "flash1.bogulus1.cfd",
  "galandriel1.thobias001.cfd",
  "galandriel1.thobias11.cfd",
  "hulky.lozixy.cfd",
  "iron1.jarvisx1.cfd",
  "iron1.xn--x2rw19a.space",
  "kuruk1.xn--okq6e.shop",
  "omega1.visionxmans1.cfd",
  "onyx1.mofta001.cfd",
  "onyx1.mofta1.cfd",
  "pulse1.sanseny001.shop",
  "pulse1.xn--x2rv05jjkg.shop",
  "saruman1.tharen001.cfd",
  "thor1.syndula001.cfd",
  "ultra3.ronanx001.shop",
];

/** How long a proxy token stays usable. */
const TOKEN_TTL_SECONDS = 60 * 60 * 6;

/** The label used when the token key is derived from the Supabase key. */
const TOKEN_SECRET_LABEL = "acum-stream-token-v1";

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
      !parsed.username &&
      !parsed.password &&
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
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return SECONDARY_HOSTS.includes(host) || MEDIA_HOSTS.includes(host);
  } catch {
    return false;
  }
}

/** True for a player page we are allowed to frame as a last resort. */
export function isAllowedEmbedUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return EMBED_HOSTS.includes(host) || MEDIA_HOSTS.includes(host);
  } catch {
    return false;
  }
}

/**
 * True for an upstream page we can read and try to resolve.
 *
 * That is the player pages on canale-tv.net and the panel hosts from the
 * checked-in catalogue — all of them hide their playlist behind the same
 * obfuscation.
 */
export function isResolvablePageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return PLAYER_HOSTS.includes(host) || MEDIA_HOSTS.includes(host);
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

/** The largest number of redirects an upstream request may follow. */
const MAX_REDIRECTS = 3;

/** An upstream request that violated the network policy. */
export class StreamPolicyError extends Error {
  /** The URL that was refused, when there was one. */
  readonly target: string | null;

  constructor(message = "Adresă nepermisă.", target: string | null = null) {
    super(message);
    this.name = "StreamPolicyError";
    this.target = target;
  }
}

/** True for an IPv4 address that must never be reached from the proxy. */
function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && parts[2] === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** True for an IPv6 address that must never be reached from the proxy. */
function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("ff")) return true;

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

/** True when an IP address is loopback, private, link-local or multicast. */
function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

/**
 * True when every address behind a hostname is publicly routable.
 *
 * The allowlist is an exact hostname list, but a hostname can still resolve
 * to a private address. The DNS answer is checked before the socket is
 * opened and again after every redirect.
 */
async function isPublicHost(hostname: string): Promise<boolean> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (isIP(bare)) return !isPrivateAddress(bare);

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return (
      addresses.length > 0 &&
      addresses.every(({ address }) => !isPrivateAddress(address))
    );
  } catch {
    return false;
  }
}

/** Validate one URL before an upstream request is made. */
async function assertPublicUrl(
  url: string,
  isAllowed: (candidate: string) => boolean,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new StreamPolicyError();
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !isAllowed(parsed.toString())
  ) {
    throw new StreamPolicyError("Adresă nepermisă.", parsed.toString());
  }

  if (!(await isPublicHost(parsed.hostname))) {
    throw new StreamPolicyError("Adresă nepermisă.", parsed.toString());
  }
}

/**
 * Fetch an upstream URL while following redirects by hand.
 *
 * Every hop is checked against the same exact-host policy and its DNS
 * answer before the next request is made. A redirect can therefore never
 * take the proxy from an allowed host to an internal address.
 */
async function fetchWithValidatedRedirects(
  initialUrl: string,
  isAllowed: (candidate: string) => boolean,
  init: RequestInit,
): Promise<Response | null> {
  let current = initialUrl;
  let redirects = 0;

  for (;;) {
    await assertPublicUrl(current, isAllowed);
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location || redirects >= MAX_REDIRECTS) {
      throw new StreamPolicyError();
    }

    current = new URL(location, current).toString();
    redirects += 1;
  }
}

/** True when a refused redirect is the upstream's known Google fallback. */
function isGoogleFallback(target: string | null): boolean {
  if (!target) return false;
  try {
    const host = new URL(target).hostname.toLowerCase();
    return host === "google.com" || host.endsWith(".google.com");
  } catch {
    return false;
  }
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

/** The derived token key, cached for the lifetime of this process. */
let cachedTokenSecret: string | null = null;

/**
 * The token key for this deployment.
 *
 * `STREAM_TOKEN_SECRET` is used when it is present. Otherwise the key is
 * derived from the server-only Supabase service-role key with a distinct
 * label, so rotating the service-role key also invalidates old stream
 * tokens. The derived value is cached and remains stable for this process.
 */
function configuredTokenSecret(): string | null {
  const explicit = process.env.STREAM_TOKEN_SECRET;
  if (explicit) return explicit;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  if (!cachedTokenSecret) {
    cachedTokenSecret = createHmac("sha256", serviceRoleKey)
      .update(TOKEN_SECRET_LABEL)
      .digest("base64url");
  }
  return cachedTokenSecret;
}

/** True when this deployment can mint and verify stream tokens. */
export function isStreamTokenConfigured(): boolean {
  return configuredTokenSecret() !== null;
}

/** Sign a token payload, or fail closed when this deployment has no key. */
function sign(payload: string): string {
  const secret = configuredTokenSecret();
  if (!secret) {
    throw new Error(
      "Cheia de semnare a tokenurilor de streaming nu este configurată.",
    );
  }
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

type StreamTokenPayload = {
  /** Payload format version. */
  v: 1;
  /** Expiry time, in seconds since the Unix epoch. */
  exp: number;
  /** The upstream address. */
  url: string;
  /** The catalogue channel the address belongs to. */
  channelId?: string;
  /** The registered stream session. */
  sessionId?: string;
  /** The audience identifier for this playback. */
  viewerId?: string;
};

/**
 * Wrap an upstream URL into an opaque, signed token.
 *
 * The browser only ever sees `/api/stream?t=…`, so the upstream hosts stay
 * invisible to it and the proxy cannot be pointed at an arbitrary address.
 *
 * The token also carries the channel, stream session and viewer id. Those
 * values are signed, so the audience count cannot be moved to another
 * channel or viewer by editing the URL.
 */
export function signStreamToken(
  url: string,
  channelId?: string,
  ttlSeconds = TOKEN_TTL_SECONDS,
  sessionId?: string,
  viewerId?: string,
): string {
  const payload: StreamTokenPayload = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    url,
  };
  if (channelId) payload.channelId = channelId;
  if (sessionId) payload.sessionId = sessionId;
  if (viewerId) payload.viewerId = viewerId;

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${sign(encoded)}`;
}

/** What a token stands for. */
export type StreamToken = {
  /** The upstream address, still on the server. */
  url: string;
  /** The channel the address belongs to, when the token carries one. */
  channelId: string | null;
  /**
   * The registered stream this token belongs to, when it has one.
   *
   * It is what the player's heartbeat keeps alive, and what a second screen
   * is counted against.
   */
  sessionId: string | null;
  /** The signed audience identifier used for the live-viewer count. */
  viewerId: string | null;
};

/** Unwrap a token back into the upstream URL, or null when it is not ours. */
export function readStreamToken(token: string): StreamToken | null {
  const separator = token.indexOf(".");
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }

  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return null;
  }

  let decoded: StreamTokenPayload;
  try {
    decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as StreamTokenPayload;
  } catch {
    return null;
  }

  if (
    decoded.v !== 1 ||
    !Number.isFinite(decoded.exp) ||
    decoded.exp * 1000 < Date.now() ||
    typeof decoded.url !== "string"
  ) {
    return null;
  }

  if (!isAllowedMediaUrl(decoded.url)) return null;
  return {
    url: decoded.url,
    channelId: decoded.channelId || null,
    sessionId: decoded.sessionId || null,
    viewerId: decoded.viewerId || null,
  };
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

  // Our helper goes last, after the upstream's own scripts.
  out = out.replace(/<\/body>/i, `${AUTO_PLAY_SCRIPT}</body>`);

  return out;
}

/* ------------------------------------------------------------------ *
 * Talking to the upstream
 * ------------------------------------------------------------------ */

/** How long one attempt at reading an upstream player page may take. */
const PAGE_TIMEOUT_MS = 15_000;

/**
 * Fetch an upstream player page. Returns null when it cannot be read.
 *
 * `deadline` is the moment the caller stops waiting, when it has one: every
 * attempt is then cut short at that moment, so a slow upstream cannot hold
 * the request open past it. Without a deadline the page is read with the
 * full timeout, exactly as it was.
 */
export async function fetchPlayerPage(
  url: string,
  deadline?: number,
): Promise<string | null> {
  for (const referer of orderedReferers(url)) {
    const left =
      deadline === undefined ? PAGE_TIMEOUT_MS : deadline - Date.now();
    if (left <= 0) return null;
    try {
      const response = await fetchWithValidatedRedirects(
        url,
        isResolvablePageUrl,
        {
          headers: {
            "user-agent": UPSTREAM_USER_AGENT,
            referer,
            accept: "text/html,application/xhtml+xml",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(Math.min(left, PAGE_TIMEOUT_MS)),
        },
      );
      if (!response?.ok) continue;
      const body = await response.text();
      if (!body.includes("cat1")) continue;
      rememberReferer(hostOf(url), referer);
      return body;
    } catch (error) {
      if (error instanceof StreamPolicyError) {
        if (isGoogleFallback(error.target)) continue;
        throw error;
      }
      /* try the next Referer */
    }
  }
  return null;
}

/** Fetch an upstream player page for framing. No obfuscation needed. */
export async function fetchEmbedPage(url: string): Promise<string | null> {
  for (const referer of orderedReferers(url)) {
    try {
      const response = await fetchWithValidatedRedirects(url, isAllowedEmbedUrl, {
        headers: {
          "user-agent": UPSTREAM_USER_AGENT,
          referer,
          accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response?.ok) continue;
      const body = await response.text();
      if (!body.trimStart().startsWith("<")) continue;
      rememberReferer(hostOf(url), referer);
      return body;
    } catch (error) {
      if (error instanceof StreamPolicyError) throw error;
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
  /** The final URL, after any validated redirect. */
  finalUrl: string;
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
      response = (await fetchWithValidatedRedirects(url, isAllowedMediaUrl, {
        headers: {
          "user-agent": UPSTREAM_USER_AGENT,
          referer,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      })) as Response;
    } catch (error) {
      if (error instanceof StreamPolicyError) {
        if (isGoogleFallback(error.target)) continue;
        throw error;
      }
      continue;
    }

    if (!response.ok || !response.body) continue;

    const { head, rest } = await splitFirstChunk(response.body);
    const probe = new TextDecoder().decode(head.slice(0, 32)).trimStart();
    // The cloaking page is HTML; a playlist starts with #EXTM3U and a
    // segment starts with the MPEG-TS sync byte.
    if (probe.startsWith("<")) continue;

    rememberReferer(hostOf(url), referer);
    return { head, rest, referer, finalUrl: response.url || url };
  }

  return null;
}

/**
 * True when the URL answers with a real playlist.
 *
 * Every Referer the host accepts is tried, not just one: the second
 * source's media host only answers to its own directory, and a feed that
 * plays perfectly well would be called broken otherwise.
 *
 * `budgetMs` is the deadline for **all** of those attempts together, not for
 * each one. The player endpoint asks for an answer in a few seconds; a feed
 * that has not spoken by then is demoted, not refused, and a dead channel
 * cannot hold the request open for the sum of its Referers.
 */
export async function probePlaylist(
  url: string,
  budgetMs = 12_000,
): Promise<boolean> {
  const deadline = Date.now() + budgetMs;

  for (const referer of orderedReferers(url)) {
    const left = deadline - Date.now();
    if (left <= 0) return false;
    try {
      const response = await fetchWithValidatedRedirects(
        url,
        isAllowedMediaUrl,
        {
          headers: {
            "user-agent": UPSTREAM_USER_AGENT,
            referer,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(Math.min(left, 8_000)),
        },
      );
      if (!response?.ok) continue;
      if (isPlaylist(await response.text())) return true;
    } catch (error) {
      if (error instanceof StreamPolicyError) {
        if (isGoogleFallback(error.target)) continue;
        throw error;
      }
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
 * A feed that cannot produce an address at all — an acestream id, a player
 * the catalogue never resolved — is dropped rather than handed to the
 * browser to fail on.
 *
 * Within one likelihood band the **better picture** goes first: an HD feed
 * is tried before an SD one carrying the same channel. The probe downstream
 * drops whatever does not answer, so a dead HD link costs one quick hop and
 * never outranks an SD feed that plays.
 *
 * Only the feed list is read, so the caller may pass anything that has one:
 * the two catalogue shapes in this repo differ in which fields they type.
 */
type FeedLike = {
  hlsUrl?: string | null;
  embedUrl?: string | null;
  source?: string | null;
  kind?: string | null;
  status?: string | null;
  quality?: string | null;
};

export function pickServer<T extends FeedLike>(channel: {
  servers: T[];
}): T[] {
  const usable = channel.servers.filter(
    (server) =>
      Boolean(server.hlsUrl) ||
      server.source === "secondary" ||
      (Boolean(server.embedUrl) &&
        server.kind !== "acestream" &&
        server.kind !== "none"),
  );

  const rank = (server: T): number => {
    if (server.hlsUrl) return 0;
    if (server.source === "secondary") return 1;
    if (isAllowedPlayerUrl(server.embedUrl)) {
      return server.status === "live" ? 2 : 4;
    }
    return server.status === "live" ? 3 : 5;
  };

  const qualityRank = (server: T): number =>
    QUALITY_META[server.quality as Quality]?.rank ??
    QUALITY_META.unknown.rank;

  return [...usable].sort(
    (a, b) => rank(a) - rank(b) || qualityRank(a) - qualityRank(b),
  );
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
