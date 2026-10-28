import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import { prepareGuide, type EpgGuide } from "@/components/now-next";
import { readChannelProgrammes, type EpgProgramme } from "@/lib/epg-source";
import type { Channel } from "@/data/types";

/**
 * Today's programme guide, prepared for the hero.
 *
 * The clock is read here rather than in the page, because a render must be
 * pure: what is on now is a property of the request, not of the component.
 * A missing guide is not a broken page — the hero falls back to the
 * channel-only view.
 *
 * Where the guide comes from, in order:
 *
 *   1. the source itself, read once every few hours and shared by every
 *      visitor behind Next's cache — this is what keeps the guide current
 *      without anyone merging a file each morning;
 *   2. `data/epg.json`, scraped by hand or by the daily workflow, which is
 *      the fallback for when the source is slow or unreachable.
 *
 * Both carry absolute timestamps, so "now" is always computed at read
 * time: a fallback a day old still tells the truth about what is on.
 */
export async function loadGuide(channels: Channel[]): Promise<EpgGuide | null> {
  const live = await loadLiveGuide();
  if (live) return prepareGuide(live, channels, Date.now(), 8).guide;

  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "epg.json"),
      "utf8",
    );
    return prepareGuide(JSON.parse(raw), channels, Date.now(), 8).guide;
  } catch {
    return null;
  }
}

/** How long one read of the source is shared before it is read again. */
const SOURCE_CACHE_HOURS = 3;

/** How many channel pages are read at once; the source answers slowly. */
const READ_CONCURRENCY = 10;

/**
 * The guide as the source has it right now, or null.
 *
 * Cached, so the whole source is walked once per cache lifetime and not
 * once per visitor. A page that will not answer costs its channel a slot
 * and nothing else: the channel simply falls back to whatever the
 * committed file has for it, and the rest of the guide is unaffected.
 *
 * It returns the raw rows, not a prepared guide: preparing needs the
 * catalogue (which channel is which, which one the hero features) and the
 * clock, and neither belongs in a shared cache entry. The caller runs
 * that step per request, on the same code path the committed file takes.
 */
async function loadLiveGuide(): Promise<RawGuide | null> {
  "use cache";
  cacheLife({
    stale: 60 * 60 * SOURCE_CACHE_HOURS,
    revalidate: 60 * 60 * SOURCE_CACHE_HOURS,
    expire: 60 * 60 * 24,
  });

  const slugs = await sourceSlugs();
  if (slugs.length === 0) return null;

  const programmes = new Map<string, EpgProgramme[]>();
  let cursor = 0;

  async function worker() {
    while (cursor < slugs.length) {
      const slug = slugs[cursor++];
      const rows = await readChannelProgrammes(slug);
      if (rows.length > 0) programmes.set(slug, rows);
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(READ_CONCURRENCY, slugs.length) }, worker),
    );
  } catch {
    return null;
  }

  if (programmes.size === 0) return null;
  return programmesToRaw(programmes);
}

/** The per-channel schedules in the shape `prepareGuide` already reads. */
type RawGuide = {
  channels: Record<
    string,
    {
      date: string;
      name: string;
      epgId: null;
      now: null;
      next: unknown[];
      programmes: EpgProgramme[];
    }
  >;
};

/**
 * The channel slugs the source carries a guide for.
 *
 * Read from the secondary directory the scraper walks, so the app and the
 * daily job look at exactly the same set of channels and neither can
 * claim a channel the other never sees.
 */
async function sourceSlugs(): Promise<string[]> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "secondary-sources.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as {
      channels?: Array<{ slug?: unknown }>;
    };
    return (parsed.channels ?? [])
      .filter(
        (entry): entry is { slug: string } =>
          typeof entry?.slug === "string" && entry.slug.length > 0,
      )
      .map((entry) => entry.slug);
  } catch {
    return [];
  }
}

/**
 * The per-channel schedules, in the shape `prepareGuide` already reads —
 * one code path for "what is on now", whether the rows came from the
 * source at read time or from the committed file.
 */
function programmesToRaw(
  programmes: Map<string, EpgProgramme[]>,
): RawGuide {
  const channels: RawGuide["channels"] = {};
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  for (const [slug, rows] of programmes) {
    channels[slug] = {
      date: today,
      name: slug,
      epgId: null,
      now: null,
      next: [],
      programmes: rows,
    };
  }

  return { channels };
}
