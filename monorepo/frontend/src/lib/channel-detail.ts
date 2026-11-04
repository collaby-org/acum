/**
 * The channel sheet behind `/api/channel/<id>`.
 *
 * Three sources, all read on the server:
 *
 *   - the catalogue, for the name and the category;
 *   - today's programme guide (`data/epg.json`), for what is on now and
 *     what follows;
 *   - the second source's directory, for how many people watch the channel
 *     and what the channel is about.
 *
 * The guide is read with `fs` and never imported: a static import of a
 * 1.2 MB JSON breaks the type checker and ships the whole file to the
 * browser. The directory is asked for once every few minutes — it is the
 * same list the player asks for when it needs a fresh stream address, so
 * the answer is cached next to it.
 *
 * Nothing here reaches the browser except through the endpoint, which
 * answers with the finished sheet: no upstream address, no source page.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  matchGuideChannels,
  normalizeGuide,
  resolveSchedule,
  type EpgGuide,
  type EpgProgramme,
} from "@/components/now-next";
import { catalogueChannel } from "@/lib/catalogue";
import { categoryLabel } from "@/lib/navigation";
import { liveAudience } from "@/lib/audience";
import {
  readChannelProgrammes,
  readChannelProgrammesById,
  type EpgProgramme as SourceProgramme,
} from "@/lib/epg-source";

/* ------------------------------------------------------------------ *
 * The shape the endpoint answers with
 * ------------------------------------------------------------------ */

/** One slot of the guide, in a shape the browser can print. */
export type ChannelProgramme = {
  title: string;
  /** When the slot starts, in Romanian time, with the offset. */
  startsAt: string | null;
  /** When the slot ends, in Romanian time, with the offset. */
  endsAt: string | null;
  /** What the slot is about, when the guide says. */
  description: string | null;
};

/** Everything the panel needs to know about one channel. */
export type ChannelDetail = {
  /** The catalogue id — the same id the player is asked for. */
  id: string;
  name: string;
  /** How many people watch it, when the directory knows. */
  views: number | null;
  /**
   * How many people are watching it here, right now. It is measured at our
   * own proxy, so it is a live crowd rather than a ranking.
   */
  liveViewers: number;
  /** The category, in the source's own words. */
  category: string;
  /** What the channel is about, when the directory knows. */
  description: string | null;
  /** The slot on air right now. */
  now: ChannelProgramme | null;
  /** The slots that follow it. */
  next: ChannelProgramme[];
};

/* ------------------------------------------------------------------ *
 * Romanian time
 * ------------------------------------------------------------------ */

const CLOCK = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Bucharest",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const OFFSET = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Bucharest",
  timeZoneName: "longOffset",
});

/**
 * A moment as an ISO stamp in Romanian time: "2026-10-22T19:00:00+03:00".
 *
 * The guide is written in local time and the browser reads it as local time
 * too, so the offset travels with the stamp — a bare "19:00" would mean
 * something else in another country.
 */
function isoInBucharest(moment: number): string {
  const parts = CLOCK.formatToParts(new Date(moment));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const zone =
    OFFSET.formatToParts(new Date(moment)).find((part) => part.type === "timeZoneName")
      ?.value ?? "GMT";
  const offset = zone === "GMT" ? "+00:00" : zone.replace("GMT", "");
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read(
    "minute",
  )}:${read("second")}${offset}`;
}

/* ------------------------------------------------------------------ *
 * The guide
 *
 * The guide is read from the source itself, behind Next's cache, and the
 * committed file is the fallback — the same two sources, in the same
 * order, that the catalogue pages read. It used to be read here straight
 * off the disk, which meant the panel answered from a snapshot while the
 * catalogue beside it answered from the source: two different schedules
 * on one screen, and a panel with no programme at all once the snapshot
 * had expired.
 * ------------------------------------------------------------------ */

/**
 * The second source's directory
 *
 * Two copies of the same directory, read in two ways.
 *
 * The snapshot is the one the scraper left in `data/`: it is on disk, it
 * is read in a millisecond and it never fails, so the description and the
 * category of a channel come from there.
 *
 * The live list is the same directory with the numbers on top — how many
 * people watch the channel. It is asked for at most every few minutes,
 * with a short patience: a slow answer is not worth a slow panel, and the
 * snapshot has already answered the rest.
 * ------------------------------------------------------------------ */

/** What the directory knows about one channel. */
type SecondaryMeta = {
  slug: string;
  views: number | null;
  description: string | null;
  category: string | null;
  /**
   * The source's own number for this channel.
   *
   * It is the door to the fast guide: the source's JSON endpoint answers
   * with a channel's rows when it is asked by number, and by nothing else.
   */
  channelId: number | null;
  /** The source's own name for the channel. */
  name: string | null;
  /** What the directory says is on air right now. */
  epgTitle: string | null;
  epgStart: string | null;
  epgEnd: string | null;
};

const SECONDARY_URL = "https://canaletvlive.online/api/channels";
const SECONDARY_REFERER = "https://canaletvlive.online/";
const SECONDARY_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
/** How long a list of the directory is good for. */
const SECONDARY_TTL = 5 * 60_000;
/** How long the panel waits for the live list. */
const SECONDARY_PATIENCE = 6_000;

let secondaryCache: { at: number; bySlug: Map<string, SecondaryMeta> } | null = null;
let secondaryPending: Promise<Map<string, SecondaryMeta>> | null = null;

function readMeta(entry: Record<string, unknown>): SecondaryMeta | null {
  const slug = typeof entry.slug === "string" ? entry.slug.trim() : "";
  if (!slug) return null;

  const views =
    typeof entry.views === "number" && Number.isFinite(entry.views)
      ? entry.views
      : null;
  const description =
    typeof entry.description === "string" && entry.description.trim()
      ? entry.description.trim()
      : null;
  const category =
    typeof entry.category_name === "string" && entry.category_name.trim()
      ? entry.category_name.trim()
      : null;
  const channelId =
    typeof entry.id === "number" && Number.isFinite(entry.id) ? entry.id : null;
  const name =
    typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : null;
  const epgTitle =
    typeof entry.epg_title === "string" && entry.epg_title.trim()
      ? entry.epg_title.trim()
      : null;
  const epgStart =
    typeof entry.start_time === "string" && entry.start_time.trim()
      ? entry.start_time.trim()
      : null;
  const epgEnd =
    typeof entry.end_time === "string" && entry.end_time.trim()
      ? entry.end_time.trim()
      : null;

  return {
    slug,
    views,
    description,
    category,
    channelId,
    name,
    epgTitle,
    epgStart,
    epgEnd,
  };
}

/**
 * The live directory, by slug.
 *
 * The list is the same one the player asks for when it needs a fresh stream
 * address, so it is worth keeping for a few minutes rather than for every
 * panel that opens.
 */
async function loadSecondaryMeta(): Promise<Map<string, SecondaryMeta>> {
  if (secondaryCache && Date.now() - secondaryCache.at < SECONDARY_TTL) {
    return secondaryCache.bySlug;
  }
  if (secondaryPending) return secondaryPending;

  secondaryPending = (async () => {
    const bySlug = new Map<string, SecondaryMeta>();
    let answered = false;
    try {
      const response = await fetch(SECONDARY_URL, {
        headers: {
          "user-agent": SECONDARY_UA,
          referer: SECONDARY_REFERER,
        },
        signal: AbortSignal.timeout(SECONDARY_PATIENCE),
      });
      if (response.ok) {
        const list = (await response.json()) as unknown;
        if (Array.isArray(list)) {
          for (const item of list) {
            if (!item || typeof item !== "object") continue;
            const meta = readMeta(item as Record<string, unknown>);
            if (meta) bySlug.set(meta.slug, meta);
          }
        }
        answered = true;
      }
    } catch {
      // The directory is a bonus: the panel works without it.
    }

    if (answered || !secondaryCache) {
      secondaryCache = { at: Date.now(), bySlug };
    } else {
      // The directory did not answer. What we had is still better than
      // nothing, but it is stale — so the next call asks again.
      secondaryCache = { at: 0, bySlug: secondaryCache.bySlug };
    }
    return secondaryCache.bySlug;
  })();

  const bySlug = await secondaryPending;
  secondaryPending = null;
  return bySlug;
}

/* ------------------------------------------------------------------ *
 * The snapshot
 * ------------------------------------------------------------------ */

let snapshotCache: Map<string, SecondaryMeta> | null = null;

/**
 * The directory as the scraper left it, by slug.
 *
 * It is the fallback for the live list: the same descriptions and the same
 * categories, without the wait and without the failure mode.
 */
async function loadSnapshot(): Promise<Map<string, SecondaryMeta>> {
  if (snapshotCache) return snapshotCache;

  const bySlug = new Map<string, SecondaryMeta>();
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "secondary-sources.json"),
      "utf8",
    );
    const payload = JSON.parse(raw) as {
      channels?: {
        slug?: string;
        description?: string;
        category?: string;
        id?: number;
        name?: string;
      }[];
    };
    for (const entry of payload.channels ?? []) {
      if (!entry || typeof entry.slug !== "string") continue;
      const meta = readMeta({
        slug: entry.slug,
        description: entry.description,
        category_name: entry.category,
        id: entry.id,
        name: entry.name,
      });
      if (meta) bySlug.set(meta.slug, meta);
    }
  } catch {
    // No snapshot: the panel simply has less to say.
  }

  snapshotCache = bySlug;
  return bySlug;
}

/* ------------------------------------------------------------------ *
 * Matching the catalogue to the directory
 * ------------------------------------------------------------------ */

/** Fold a name down to comparable letters and digits. */
function foldKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * The directory entry of a catalogue channel, when there is one.
 *
 * A feed that comes from the second source carries its slug as its own id,
 * so that answer needs no guessing. The rest are matched on the name:
 * "PRO TV" and "protv" fold to the same letters.
 */
function secondaryMetaFor(
  channel: {
    id: string;
    name: string;
    familyKey: string;
    servers: {
      id: string;
      source: "primary" | "secondary" | "canale-tv";
    }[];
  },
  bySlug: Map<string, SecondaryMeta>,
): SecondaryMeta | null {
  for (const server of channel.servers) {
    if (server.source !== "secondary") continue;
    const hit = bySlug.get(server.id);
    if (hit) return hit;
  }

  const byFold = new Map<string, SecondaryMeta>();
  for (const meta of bySlug.values()) {
    const key = foldKey(meta.slug);
    if (key && !byFold.has(key)) byFold.set(key, meta);
  }

  for (const candidate of [channel.id, channel.familyKey, channel.name]) {
    const hit = byFold.get(foldKey(candidate));
    if (hit) return hit;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * The sheet
 * ------------------------------------------------------------------ */

function programmeOf(programme: EpgProgramme): ChannelProgramme {
  return {
    title: programme.title,
    startsAt: isoInBucharest(programme.start),
    endsAt: isoInBucharest(programme.end),
    description: programme.description,
  };
}

/* ------------------------------------------------------------------ *
 * The guide of one channel
 * ------------------------------------------------------------------ */

/**
 * The committed guide, read once per process.
 *
 * It is the last door: a snapshot of a day's schedule, but a schedule is
 * better than an empty panel. It is opened only when the source cannot
 * answer, so the file is read at most once.
 */
let committedGuide: EpgGuide | null | undefined;

async function loadCommittedGuide(): Promise<EpgGuide | null> {
  if (committedGuide !== undefined) return committedGuide;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "epg.json"),
      "utf8",
    );
    committedGuide = normalizeGuide(JSON.parse(raw));
  } catch {
    committedGuide = null;
  }
  return committedGuide;
}

/**
 * One channel's rows, in the shape the guide is read from.
 *
 * The same shape `normalizeGuide` already reads, so the panel resolves the
 * schedule on the same code path whether the rows came from the source or
 * from the committed file.
 */
function guideFromRows(
  programmes: SourceProgramme[],
  slug: string | null,
  name: string | null,
): EpgGuide {
  const key = slug ?? "channel";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return normalizeGuide({
    channels: {
      [key]: {
        date: today,
        name: name ?? key,
        epgId: null,
        now: null,
        next: [],
        programmes,
      },
    },
  });
}

/** True when one of the rows is the programme that is on air right now. */
function coversNow(programmes: SourceProgramme[]): boolean {
  const moment = Date.now();
  return programmes.some((programme) => {
    const start = Date.parse(programme.startsAt);
    const end = Date.parse(programme.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return moment >= start && moment < end;
  });
}

/**
 * The sheet of one channel, or null when the catalogue has no such
 * channel.
 *
 * The clock is read here, on the server: what is on now is a property of
 * the request, not of the component that shows it.
 *
 * The guide is read for THIS channel only. Walking every channel's guide
 * to answer a question about one of them is what used to make the panel
 * wait three seconds for a sheet about one programme.
 */
export async function loadChannelDetail(
  id: string,
): Promise<ChannelDetail | null> {
  const channel = catalogueChannel(id);
  if (!channel) return null;

  // The snapshot is on disk and answers at once. It carries the source's
  // own number for every channel, and that number is the door to the fast
  // guide — so the guide is asked for while the live directory is still on
  // its way.
  const snapshot = await loadSnapshot();
  const fallback = secondaryMetaFor(channel, snapshot);

  const [live, rows] = await Promise.all([
    loadSecondaryMeta(),
    fallback?.channelId
      ? readChannelProgrammesById(fallback.channelId)
      : Promise.resolve([] as SourceProgramme[]),
  ]);

  const meta = secondaryMetaFor(channel, live);
  const slug = meta?.slug ?? fallback?.slug ?? null;

  let programmes: SourceProgramme[] = rows;
  if (
    programmes.length === 0 &&
    meta?.channelId &&
    meta.channelId !== fallback?.channelId
  ) {
    programmes = await readChannelProgrammesById(meta.channelId);
  }
  if (programmes.length === 0 && slug) {
    programmes = await readChannelProgrammes(slug);
  }
  if (programmes.length > 0 && !coversNow(programmes) && slug) {
    // The fast answer starts after this moment. The watch page carries the
    // whole day, so it is asked when the rows do not cover the moment the
    // panel is asking about.
    const wholeDay = await readChannelProgrammes(slug);
    if (wholeDay.length > 0) programmes = wholeDay;
  }

  const guide =
    programmes.length > 0
      ? guideFromRows(programmes, slug, meta?.name ?? fallback?.name ?? null)
      : await loadCommittedGuide();

  let now: ChannelProgramme | null = null;
  let next: ChannelProgramme[] = [];

  if (guide && guide.channels.length > 0) {
    const matched = matchGuideChannels(guide, [channel]);
    const guideChannel = matched.get(channel.id);
    if (guideChannel) {
      const schedule = resolveSchedule(guideChannel, Date.now());
      now = schedule.now ? programmeOf(schedule.now) : null;
      next = schedule.next.map(programmeOf);
    }
  }

  // The directory says what is on air in its own words. When the rows do
  // not cover this very moment, the directory's answer is the honest one.
  if (!now && meta?.epgTitle && meta.epgStart && meta.epgEnd) {
    const start = Date.parse(meta.epgStart);
    const end = Date.parse(meta.epgEnd);
    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      Date.now() >= start &&
      Date.now() < end
    ) {
      now = {
        title: meta.epgTitle,
        startsAt: isoInBucharest(start),
        endsAt: isoInBucharest(end),
        description: null,
      };
    }
  }

  // The live list knows the numbers; the snapshot knows the words. Either
  // one can be missing, and the other one fills the gap.

  return {
    id: channel.id,
    name: channel.name,
    // Two numbers, and they are not the same thing. `liveViewers` is ours,
    // counted at the proxy over the last minute and a half. `views` is the
    // directory's cumulative counter — a ranking, not a crowd.
    liveViewers: liveAudience(channel.id),
    views: meta?.views ?? fallback?.views ?? null,
    category:
      meta?.category ?? fallback?.category ?? categoryLabel(channel.category),
    description: meta?.description ?? fallback?.description ?? null,
    now,
    next,
  };
}
