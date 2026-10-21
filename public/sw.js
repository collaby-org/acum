/**
 * VIZOR service worker.
 *
 * The rules, in one place:
 *
 *  - Live video never touches the cache. A stale stream is worse than no
 *    stream, so anything that looks like media is passed straight through.
 *  - The app shell is precached, so the catalogue opens even with no network.
 *  - Navigations are network-first: the catalogue changes, and a fresh copy
 *    is always better when the network allows it. The cached copy is the
 *    fallback, and `/offline.html` is the last resort.
 *  - Static assets are cache-first: their names are content-hashed, so a hit
 *    is always the right file.
 *
 * The worker never caches cross-origin requests — the upstream players and
 * their playlists stay the browser's business.
 */

const VERSION = "v1";

const SHELL_CACHE = `vizor-shell-${VERSION}`;
const PAGE_CACHE = `vizor-pages-${VERSION}`;
const ASSET_CACHE = `vizor-assets-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, PAGE_CACHE, ASSET_CACHE];

/** The files the app needs before the network says anything. */
const SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

/** Never intercepted: the worker itself and the live API. */
const NEVER_CACHE = ["/api/", "/sw.js"];

/** Media and playlists — always straight from the network. */
const MEDIA = /\.(m3u8|mpd|ts|m4s|mp4|webm|mov|m4a|mp3|aac|flv)(\?|$)/i;

/* ------------------------------------------------------------------ *
 * Install
 * ------------------------------------------------------------------ */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One missing file must not fail the whole install.
      await Promise.allSettled(
        SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
    })(),
  );
});

/* ------------------------------------------------------------------ *
 * Activate
 * ------------------------------------------------------------------ */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/* ------------------------------------------------------------------ *
 * Fetch
 * ------------------------------------------------------------------ */
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Upstream players, their playlists and any other origin stay untouched.
  if (url.origin !== self.location.origin) return;

  if (NEVER_CACHE.some((path) => url.pathname.startsWith(path))) return;
  if (MEDIA.test(url.pathname)) return;

  // Byte ranges are part of a media stream, never a cache entry.
  if (request.headers.has("range")) return;

  // React Server Component payloads carry the live tree — never stale.
  if (
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1"
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request));
});

/**
 * Network first, cache second, offline page last.
 */
async function handleNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // The page we saw last…
    const cached = await cache.match(request);
    if (cached) return cached;

    // …then the shell precached at install time…
    const shell = await caches.open(SHELL_CACHE);
    const precached = await shell.match(request);
    if (precached) return precached;

    // …and only then the offline notice.
    const offline = await shell.match("/offline.html");
    if (offline) return offline;

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/**
 * Cache first, refresh in the background.
 */
async function handleAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Keep the refresh going, but never let it reject unhandled.
    network.catch(() => null);
    return cached;
  }

  const response = await network;
  if (response) return response;

  return new Response("", { status: 504, statusText: "Gateway Timeout" });
}

/* ------------------------------------------------------------------ *
 * Messages from the page
 * ------------------------------------------------------------------ */
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "CACHE_APP_SHELL") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        await Promise.allSettled(
          SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))),
        );
      })(),
    );
  }
});
