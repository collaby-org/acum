/**
 * The second source directory.
 *
 * Its channel list lives behind an API that hands out a **short-lived token**
 * for every stream — measured at roughly three minutes — and the media host
 * answers `403` for anything that does not arrive with the right `Referer`.
 * A browser can set neither, so the whole thing lives here: the server asks
 * for a fresh address, and the proxy relays it.
 *
 * The token is refreshed rather than stored. The list is cached for a minute
 * and a half, which is comfortably inside the token's lifetime.
 */

const CHANNELS_URL = "https://canaletvlive.online/api/channels";
const REFERER = "https://canaletvlive.online/";
const CACHE_MS = 90_000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

type Entry = {
  slug?: string;
  name?: string;
  stream_url?: string;
};

let cache: { at: number; bySlug: Map<string, string> } | null = null;

async function load(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.bySlug;

  const res = await fetch(CHANNELS_URL, {
    headers: { "user-agent": UA, referer: REFERER },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    // A stale list still beats nothing while the upstream is wobbling.
    return cache?.bySlug ?? new Map();
  }

  const list = (await res.json()) as Entry[];
  const bySlug = new Map<string, string>();
  for (const entry of list) {
    if (entry?.slug && entry.stream_url) bySlug.set(entry.slug, entry.stream_url);
  }

  cache = { at: Date.now(), bySlug };
  return bySlug;
}

/**
 * A fresh, playable address for one of the second source's channels, or null
 * when the channel is not offered any more.
 */
export async function secondaryStreamUrl(slug: string): Promise<string | null> {
  const bySlug = await load();
  return bySlug.get(slug) ?? null;
}
