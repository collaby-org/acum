/**
 * The second source directory.
 *
 * Its channel list lives behind an API that hands out a **short-lived token**
 * for every stream — measured at roughly three minutes — and the media host
 * answers `403` for anything that does not arrive with the right `Referer`.
 * A browser can set neither, so the whole thing lives here: the server asks
 * for a fresh address, and the proxy relays it.
 *
 * The same list carries the number of people watching each channel right
 * now. That is the app's only trending signal, so it is read here too.
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
  views?: number;
  category_name?: string;
  description?: string;
  epg_title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

/**
 * What the second source publishes about one of its channels.
 *
 * `views` is the number of people watching the channel right now — the
 * source's own counter. It is the only trending signal the app has, so it
 * travels with the rest of the record.
 */
export type SecondaryMeta = {
  slug: string;
  name: string;
  views: number;
  category: string;
  description: string;
  epgTitle: string | null;
  startTime: string | null;
  endTime: string | null;
};

/** The same record plus the short-lived stream address. */
type SecondaryChannel = SecondaryMeta & { streamUrl: string | null };

let cache: { at: number; bySlug: Map<string, SecondaryChannel> } | null = null;

/** Read one field of the directory's record, without trusting its type. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function load(): Promise<Map<string, SecondaryChannel>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.bySlug;

  let res: Response;
  try {
    res = await fetch(CHANNELS_URL, {
      headers: { "user-agent": UA, referer: REFERER },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // The directory is a bonus: the player works without it, and a stale
    // list still beats nothing while the upstream is wobbling.
    return cache?.bySlug ?? new Map();
  }
  if (!res.ok) {
    // A stale list still beats nothing while the upstream is wobbling.
    return cache?.bySlug ?? new Map();
  }

  let list: Entry[];
  try {
    list = (await res.json()) as Entry[];
  } catch {
    return cache?.bySlug ?? new Map();
  }

  const bySlug = new Map<string, SecondaryChannel>();
  for (const entry of list) {
    if (!entry?.slug) continue;
    bySlug.set(entry.slug, {
      slug: entry.slug,
      name: text(entry.name) || entry.slug,
      views: typeof entry.views === "number" && Number.isFinite(entry.views) ? entry.views : 0,
      category: text(entry.category_name),
      description: text(entry.description),
      epgTitle: text(entry.epg_title) || null,
      startTime: text(entry.start_time) || null,
      endTime: text(entry.end_time) || null,
      streamUrl: text(entry.stream_url) || null,
    });
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
  return bySlug.get(slug)?.streamUrl ?? null;
}

/**
 * What the second source knows about its channels, by slug.
 *
 * The player asks for the list when it needs a fresh stream address; the
 * page asks for it when it needs to know what people are watching. Both
 * read the same cached list.
 */
export async function getSecondaryMeta(): Promise<Map<string, SecondaryMeta>> {
  const bySlug = await load();
  const meta = new Map<string, SecondaryMeta>();
  for (const [slug, entry] of bySlug) {
    meta.set(slug, {
      slug: entry.slug,
      name: entry.name,
      views: entry.views,
      category: entry.category,
      description: entry.description,
      epgTitle: entry.epgTitle,
      startTime: entry.startTime,
      endTime: entry.endTime,
    });
  }
  return meta;
}
