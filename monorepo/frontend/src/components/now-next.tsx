import Image from "next/image";
import type { CategoryId, ServerStatus } from "@/data/types";
import { familyHue } from "@/lib/channel-meta";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * The guide model
 *
 * `data/epg.json` is produced outside the app, so the reader below is
 * deliberately forgiving: it accepts the spellings a broadcaster scrape
 * realistically uses and folds them into one shape the hero can trust.
 * ------------------------------------------------------------------ */

/**
 * The channel fields the guide needs. Both the full catalogue channel
 * and the public one the browser receives satisfy it.
 */
export type GuideChannelLike = {
  id: string;
  name: string;
  family: string;
  familyKey: string;
  category: CategoryId;
  logo: string | null;
  status: ServerStatus;
};

/**
 * True when the browser can open the channel. The public catalogue
 * keeps the status but drops the upstream addresses, so this reads the
 * status rather than the feeds.
 */
function isLive(channel: GuideChannelLike): boolean {
  return channel.status === "live";
}

/** One slot in the guide — a show or a film, with its airing window. */
export type EpgProgramme = {
  title: string;
  /** Start, in epoch milliseconds. */
  start: number;
  /** End, in epoch milliseconds. */
  end: number;
  category: string | null;
  description: string | null;
};

/** One channel and everything it airs on the guide's day. */
export type EpgChannel = {
  slug: string;
  name: string;
  logo: string | null;
  programmes: EpgProgramme[];
};

/** A whole day of guide data. */
export type EpgGuide = {
  /** The day the guide covers, as the source prints it ("2026-10-22"). */
  date: string | null;
  /** When the guide was produced, in epoch milliseconds. */
  reference: number | null;
  channels: EpgChannel[];
};

/** A channel's day, resolved against the clock. */
export type ChannelSchedule = {
  channel: EpgChannel;
  /** The slot on air right now. */
  now: EpgProgramme | null;
  /** The slots that follow it. */
  next: EpgProgramme[];
  /** Minutes left of the current slot. */
  endsIn: number | null;
  /** How far we are through the current slot, 0..1. */
  progress: number;
};

/** A programme worth putting in front of the visitor. */
export type EpgHighlight<C extends GuideChannelLike = GuideChannelLike> = {
  channel: EpgChannel;
  programme: EpgProgramme;
  /** True when the slot is on air right now. */
  onNow: boolean;
  /** Minutes until it starts. Negative once it has started. */
  startsIn: number;
  /** How far we are through it, 0..1. */
  progress: number;
  /** The catalogue channel it maps to, when it maps to one. */
  catalogue: C | null;
  /** The family hue the slot is tinted with. */
  hue: number;
  /** How interesting the slot is, 0 and up. */
  score: number;
};

/* ------------------------------------------------------------------ *
 * Reading the guide
 * ------------------------------------------------------------------ */

/** Prime time — the window the owner cares about. */
export const PRIME_TIME = { from: 18 * 60, to: 22 * 60 };

/** How far ahead the rail looks for something worth watching. */
export const HIGHLIGHT_HORIZON = 240;

/** How many highlights the rail shows. */
export const HIGHLIGHT_LIMIT = 8;

const EMPTY_GUIDE: EpgGuide = { date: null, reference: null, channels: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/**
 * Romanian copy with the correct diacritics. Broadcast feeds often ship
 * the cedilla forms (Ş, Ţ); Romanian uses the comma-below ones.
 */
function diacritics(value: string): string {
  return value.replace(/Ş/g, "Ș").replace(/ş/g, "ș").replace(/Ţ/g, "Ț").replace(/ţ/g, "ț");
}

const BUCHAREST = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bucharest",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function bucharestParts(moment: number) {
  const parts = BUCHAREST.formatToParts(new Date(moment));
  const read = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hours: read("hour"), minutes: read("minute"), seconds: read("second") };
}

/** Minutes past midnight in Romanian time. */
export function bucharestMinutes(moment: number): number {
  const { hours, minutes } = bucharestParts(moment);
  return hours * 60 + minutes;
}

/**
 * The offset of Europe/Bucharest at a given moment, in milliseconds.
 * Romania is UTC+2 in winter and UTC+3 in summer; the guide is written
 * in local time, so every wall clock has to be read back through it.
 */
function bucharestOffset(moment: number): number {
  const { hours, minutes, seconds } = bucharestParts(moment);
  const wall = Date.UTC(
    1970,
    0,
    1,
    hours,
    minutes,
    seconds,
  );
  const utc = new Date(moment);
  const utcWall = Date.UTC(
    utc.getUTCFullYear(),
    utc.getUTCMonth(),
    utc.getUTCDate(),
    utc.getUTCHours(),
    utc.getUTCMinutes(),
    utc.getUTCSeconds(),
  );
  return utcWall - wall;
}

/** Epoch milliseconds for a wall clock in Romanian time. */
function zonedMoment(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
): number {
  const guess = Date.UTC(year, month - 1, day, hours, minutes);
  return guess - bucharestOffset(guess);
}

/** Epoch milliseconds of midnight, Romanian time, on the guide's day. */
function dayStart(day: string | null): number | null {
  if (!day) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return null;
  return zonedMoment(Number(match[1]), Number(match[2]), Number(match[3]), 0, 0);
}

/**
 * A moment the guide names, in epoch milliseconds.
 *
 * Absolute timestamps are read as they are. A bare wall clock is read
 * as Romanian time on the guide's day, because that is how a
 * timetable is written.
 */
function parseMoment(value: unknown, day: string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1e11) return value;
    if (value >= 0 && value < 1440) {
      const base = dayStart(day);
      return base === null ? null : base + value * 60_000;
    }
    return null;
  }
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    const epoch = Date.parse(raw);
    if (!Number.isNaN(epoch)) return epoch;
  }

  const stamp = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(raw);
  if (stamp) {
    return zonedMoment(
      Number(stamp[1]),
      Number(stamp[2]),
      Number(stamp[3]),
      Number(stamp[4]),
      Number(stamp[5]),
    );
  }

  const clock = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (clock) {
    const base = dayStart(day);
    if (base === null) return null;
    return base + (Number(clock[1]) * 60 + Number(clock[2])) * 60_000;
  }
  return null;
}

const PROGRAMME_LIST_KEYS = [
  "programmes",
  "programs",
  "shows",
  "items",
  "grid",
  "slots",
  "entries",
  "schedule",
  "next",
  "later",
];

function normalizeProgramme(
  raw: unknown,
  day: string | null,
): EpgProgramme | null {
  if (!isRecord(raw)) return null;
  const title = text(
    raw.title,
    raw.name,
    raw.program,
    raw.programme,
    raw.show,
    raw.subject,
    raw.label,
  );
  if (!title) return null;

  const start = parseMoment(
    raw.startsAt ?? raw.starts_at ?? raw.start ?? raw.startTime ?? raw.from,
    day,
  );
  if (start === null) return null;

  let end = parseMoment(
    raw.endsAt ?? raw.ends_at ?? raw.end ?? raw.endTime ?? raw.to,
    day,
  );
  if (end === null || end <= start) end = start + 30 * 60_000;

  return {
    title: diacritics(title),
    start,
    end,
    category: text(raw.category, raw.genre, raw.type, raw.kind),
    description: text(raw.description, raw.synopsis, raw.summary, raw.desc),
  };
}

function channelProgrammes(
  record: Record<string, unknown>,
  day: string | null,
): EpgProgramme[] {
  const collected: EpgProgramme[] = [];
  const seen = new Set<string>();

  const push = (item: unknown) => {
    const programme = normalizeProgramme(item, day);
    if (!programme) return;
    const key = `${programme.start}-${programme.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    collected.push(programme);
  };

  // The day itself first: it is the only list that covers everything.
  for (const key of PROGRAMME_LIST_KEYS) {
    const list = record[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) push(item);
  }

  // `now` is a snapshot; it is the fallback when no day list exists.
  const now = record.now;
  if (isRecord(now)) push(now);
  else if (Array.isArray(now)) for (const item of now) push(item);

  collected.sort((a, b) => a.start - b.start);
  return collected;
}

function normalizeChannels(payload: unknown, day: string | null): EpgChannel[] {
  const channels: EpgChannel[] = [];

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const record = isRecord(item) ? item : null;
      if (!record) continue;
      const programmes = channelProgrammes(record, day);
      if (programmes.length === 0) continue;
      const slug =
        text(record.slug, record.id, record.key, record.epgId) ?? "";
      channels.push({
        slug,
        name: text(record.name, record.title, record.label) ?? slug,
        logo: text(record.logo, record.logoUrl, record.image, record.poster),
        programmes,
      });
    }
    return channels;
  }

  if (!isRecord(payload)) return channels;

  for (const [key, value] of Object.entries(payload)) {
    if (!isRecord(value)) continue;
    const programmes = channelProgrammes(value, day);
    if (programmes.length === 0) continue;
    channels.push({
      slug: text(value.slug, value.id, value.key) ?? key,
      name: text(value.name, value.title, value.label) ?? key,
      logo: text(value.logo, value.logoUrl, value.image, value.poster),
      programmes,
    });
  }
  return channels;
}

/**
 * Read any plausible guide file into the one shape the hero uses.
 * Safe to call twice: a guide that is already normalised survives it.
 */
export function normalizeGuide(raw: unknown): EpgGuide {
  if (!isRecord(raw)) return EMPTY_GUIDE;

  const date = text(raw.date, raw.day, raw.dayId, raw.dataDate);
  const reference = parseMoment(
    raw.generatedAt ?? raw.updatedAt ?? raw.fetchedAt ?? raw.timestamp,
    date,
  );

  const payload =
    raw.channels ?? raw.schedule ?? raw.grid ?? raw.stations ?? raw;

  return { date, reference, channels: normalizeChannels(payload, date) };
}

/* ------------------------------------------------------------------ *
 * Matching the guide to the catalogue
 * ------------------------------------------------------------------ */

/** Fold a name or a slug down to comparable letters and digits. */
export function foldKey(value: string): string {
  return value
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
export function baseKey(value: string): string {
  return foldKey(value)
    .replace(/(?:fhd|uhd|hd|sd)$/, "")
    .replace(/\d+$/, "");
}

function buildIndex(guide: EpgGuide): Map<string, EpgChannel> {
  const index = new Map<string, EpgChannel>();
  for (const channel of guide.channels) {
    for (const key of [foldKey(channel.slug), foldKey(channel.name)]) {
      if (key && !index.has(key)) index.set(key, channel);
    }
  }
  return index;
}

function lookup(
  index: Map<string, EpgChannel>,
  channel: GuideChannelLike,
): EpgChannel | null {
  const candidates = [channel.id, channel.name, channel.family, channel.familyKey];
  for (const candidate of candidates) {
    const hit = index.get(foldKey(candidate));
    if (hit) return hit;
  }
  for (const candidate of candidates) {
    const key = baseKey(candidate);
    if (!key) continue;
    const hit = index.get(key);
    if (hit) return hit;
  }
  return null;
}

/** The guide channel that belongs to a catalogue channel, if any. */
export function findGuideChannel(
  guide: EpgGuide,
  channel: GuideChannelLike,
): EpgChannel | null {
  if (guide.channels.length === 0) return null;
  return lookup(buildIndex(guide), channel);
}

/** Every catalogue channel that has a guide entry, by catalogue id. */
export function matchGuideChannels<C extends GuideChannelLike>(
  guide: EpgGuide,
  channels: readonly C[],
): Map<string, EpgChannel> {
  const matched = new Map<string, EpgChannel>();
  if (guide.channels.length === 0) return matched;
  const index = buildIndex(guide);
  for (const channel of channels) {
    const hit = lookup(index, channel);
    if (hit) matched.set(channel.id, hit);
  }
  return matched;
}

/* ------------------------------------------------------------------ *
 * The clock
 * ------------------------------------------------------------------ */

const MINUTE = 60_000;

/** True while the slot is on air. */
function isOnAir(programme: EpgProgramme, moment: number): boolean {
  return moment >= programme.start && moment < programme.end;
}

/** Minutes until the slot starts. Negative once it has started. */
function startsIn(programme: EpgProgramme, moment: number): number {
  return (programme.start - moment) / MINUTE;
}

/** How far through the slot we are, 0..1. */
function progressOf(programme: EpgProgramme, moment: number): number {
  const length = programme.end - programme.start;
  if (length <= 0) return 0;
  return Math.max(0, Math.min(1, (moment - programme.start) / length));
}

/** Resolve a channel's day against the clock. */
export function resolveSchedule(
  channel: EpgChannel,
  moment: number,
): ChannelSchedule {
  let nowProgramme: EpgProgramme | null = null;
  for (const programme of channel.programmes) {
    if (isOnAir(programme, moment)) {
      nowProgramme = programme;
      break;
    }
  }

  const next = channel.programmes
    .filter((programme) => programme.start > moment)
    .slice(0, 3);

  return {
    channel,
    now: nowProgramme,
    next,
    endsIn: nowProgramme ? (nowProgramme.end - moment) / MINUTE : null,
    progress: nowProgramme ? progressOf(nowProgramme, moment) : 0,
  };
}

/**
 * The moment the guide itself was written for. The server and the
 * client both start from it, so the first paint never disagrees with
 * the hydration.
 */
export function referenceMoment(guide: EpgGuide | null | undefined): number {
  if (!guide) return 0;
  if (guide.reference !== null) return guide.reference;
  for (const channel of guide.channels) {
    const first = channel.programmes[0];
    if (first) return first.start;
  }
  return 0;
}

/* ------------------------------------------------------------------ *
 * Picking the highlights
 * ------------------------------------------------------------------ */

function scoreOf(
  programme: EpgProgramme,
  onNow: boolean,
  minutes: number,
  catalogue: GuideChannelLike | null,
): number {
  let score = onNow ? 1000 : 0;

  const start = bucharestMinutes(programme.start);
  if (start >= PRIME_TIME.from && start < PRIME_TIME.to) score += 120;
  score += onNow
    ? Math.max(0, 60 - Math.floor(-minutes))
    : Math.max(0, 90 - Math.floor(minutes));
  if (programme.description) score += 12;
  if (programme.category) score += 8;
  // A generalist channel is what most people came for.
  if (catalogue?.category === "generaliste") score += 25;
  return score;
}

/**
 * The hue a slot is tinted with: the catalogue family's own hue when the
 * guide channel is one we know, a stable one otherwise.
 */
function hueFor(
  channel: EpgChannel,
  catalogue: GuideChannelLike | null,
): number {
  if (catalogue) return familyHue(catalogue.familyKey, catalogue.category);
  let hash = 2166136261;
  const seed = channel.slug || channel.name;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 1673741517);
  }
  return Math.abs(hash) % 360;
}

/**
 * The programmes worth showing: everything on air now, plus what the
 * next few hours bring, prime time first.
 */
export function pickHighlights<C extends GuideChannelLike = GuideChannelLike>(
  guide: EpgGuide,
  catalogue: readonly C[],
  moment: number,
  options: { limit?: number; excludeSlug?: string | null } = {},
): EpgHighlight<C>[] {
  const limit = options.limit ?? HIGHLIGHT_LIMIT;
  if (guide.channels.length === 0 || limit <= 0) return [];

  const matched = matchGuideChannels(guide, catalogue);
  const byGuideSlug = new Map<string, C>();
  for (const channel of catalogue) {
    const hit = matched.get(channel.id);
    if (!hit) continue;
    const current = byGuideSlug.get(hit.slug);
    if (!current) byGuideSlug.set(hit.slug, channel);
    else if (!isLive(current) && isLive(channel)) {
      byGuideSlug.set(hit.slug, channel);
    }
  }

  const onAir: EpgHighlight<C>[] = [];
  const upcoming: EpgHighlight<C>[] = [];

  for (const channel of guide.channels) {
    if (options.excludeSlug && channel.slug === options.excludeSlug) continue;
    const catalogueChannel = byGuideSlug.get(channel.slug) ?? null;

    for (const programme of channel.programmes) {
      const running = isOnAir(programme, moment);
      const minutes = startsIn(programme, moment);
      if (!running && (minutes < 0 || minutes > HIGHLIGHT_HORIZON)) continue;

      const highlight: EpgHighlight<C> = {
        channel,
        programme,
        onNow: running,
        startsIn: minutes,
        progress: running ? progressOf(programme, moment) : 0,
        catalogue: catalogueChannel,
        hue: hueFor(channel, catalogueChannel),
        score: scoreOf(programme, running, minutes, catalogueChannel),
      };
      (running ? onAir : upcoming).push(highlight);
    }
  }

  onAir.sort((a, b) => b.score - a.score);
  upcoming.sort((a, b) => a.startsIn - b.startsIn || b.score - a.score);

  // One card per family, so the rail shows a spread and not five
  // football channels in a row.
  const seenFamilies = new Set<string>();
  const spread: EpgHighlight<C>[] = [];
  const rest: EpgHighlight<C>[] = [];
  for (const highlight of onAir) {
    const family = highlight.catalogue?.family ?? highlight.channel.slug;
    if (seenFamilies.has(family)) {
      rest.push(highlight);
      continue;
    }
    seenFamilies.add(family);
    spread.push(highlight);
  }

  const onAirCount = Math.min(
    spread.length + rest.length,
    Math.max(3, Math.ceil(limit * 0.6)),
  );
  const picked = [...spread, ...rest].slice(0, onAirCount);
  const pickedAll = [...picked, ...upcoming].slice(0, limit);

  pickedAll.sort((a, b) => {
    if (a.onNow !== b.onNow) return a.onNow ? -1 : 1;
    return a.programme.start - b.programme.start;
  });
  return pickedAll;
}

/**
 * The catalogue channel the hero should feature: one the guide covers,
 * that can play, and that is on air with something worth watching.
 * Returns null when the guide covers none of the catalogue.
 */
export function pickFeaturedChannel<C extends GuideChannelLike>(
  channels: readonly C[],
  guide: EpgGuide | null | undefined,
  moment: number,
): C | null {
  if (!guide || guide.channels.length === 0) return null;

  const matched = matchGuideChannels(guide, channels);
  const seen = new Set<string>();
  let best: { channel: C; score: number } | null = null;

  for (const channel of channels) {
    const hit = matched.get(channel.id);
    if (!hit || seen.has(hit.slug)) continue;
    seen.add(hit.slug);

    const schedule = resolveSchedule(hit, moment);
    const programme = schedule.now;
    let score = 0;
    if (programme) {
      score += 100;
      if (programme.description) score += 20;
      const start = bucharestMinutes(programme.start);
      if (start >= PRIME_TIME.from && start < PRIME_TIME.to) score += 40;
    }
    if (isLive(channel)) score += 30;
    if (channel.category === "generaliste") score += 25;
    if (channel.family === channel.name) score += 10;

    if (!best || score > best.score) best = { channel, score };
  }

  return best?.channel ?? null;
}

/* ------------------------------------------------------------------ *
 * Preparing the guide for the client
 * ------------------------------------------------------------------ */

export type PreparedGuide<C extends GuideChannelLike = GuideChannelLike> = {
  /** The guide, slimmed for the client. */
  guide: EpgGuide;
  /** The channel the guide suits best, when it suits one. */
  featured: C | null;
  /** How many catalogue channels the guide resolved. */
  matched: number;
};

/**
 * Read `data/epg.json` into the guide the hero renders.
 *
 * The descriptions are the bulk of the file and the hero only needs the
 * one on the featured channel, so they are dropped everywhere else.
 *
 * `windowHours` keeps only the slots that run in the hours around the
 * moment, which is what a visitor actually sees. The whole day is kept
 * when it is left at zero.
 */
export function prepareGuide<C extends GuideChannelLike>(
  raw: unknown,
  catalogue: readonly C[],
  moment?: number,
  windowHours = 0,
): PreparedGuide<C> {
  const guide = normalizeGuide(raw);
  const at = moment ?? referenceMoment(guide);
  const matched = matchGuideChannels(guide, catalogue);
  const featured = pickFeaturedChannel(catalogue, guide, at);

  const keep = new Set<string>();
  if (featured) {
    const guideChannel = matched.get(featured.id);
    if (guideChannel) {
      const schedule = resolveSchedule(guideChannel, at);
      const wanted = [schedule.now, ...schedule.next].filter(Boolean);
      for (const programme of wanted) {
        keep.add(`${guideChannel.slug}:${programme?.start}`);
      }
    }
  }

  const from = at - 60 * MINUTE;
  const to = at + windowHours * 60 * MINUTE;

  const slim: EpgGuide = {
    date: guide.date,
    reference: windowHours > 0 ? at : guide.reference,
    channels: guide.channels.map((channel) => ({
      slug: channel.slug,
      name: channel.name,
      logo: channel.logo,
      programmes: channel.programmes
        .filter(
          (programme) =>
            windowHours === 0 ||
            (programme.end > from && programme.start < to),
        )
        .map((programme) => ({
          title: programme.title,
          start: programme.start,
          end: programme.end,
          category: programme.category,
          description: keep.has(`${channel.slug}:${programme.start}`)
            ? programme.description
            : null,
        })),
    })),
  };

  return { guide: slim, featured, matched: matched.size };
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/** A moment as "19:30", in Romanian time. */
export function formatClock(moment: number): string {
  const { hours, minutes } = bucharestParts(moment);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** A duration as "48 min" or "1 h 20". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

/** The guide's day, in Romanian: "joi, 22 octombrie". */
export function formatGuideDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Bucharest",
  }).format(parsed);
}

/* ------------------------------------------------------------------ *
 * The components
 * ------------------------------------------------------------------ */

export type NowNextProps = {
  /** The channel's day, already resolved against the clock. */
  schedule: ChannelSchedule | null;
  /** The family hue, used to tint the progress line. */
  hue?: number;
  className?: string;
};

/**
 * The now/next strip: what is on, how far into it we are, and what
 * follows. Renders nothing when the channel has no guide.
 */
export function NowNext({ schedule, hue = 26, className }: NowNextProps) {
  if (!schedule) return null;
  const { now, next, endsIn } = schedule;
  if (!now && next.length === 0) return null;

  return (
    <div className={cn("min-w-0", className)}>
      {now ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{
                borderColor: `hsl(${hue} 80% 60% / 0.32)`,
                backgroundColor: `hsl(${hue} 80% 55% / 0.12)`,
                color: `hsl(${hue} 92% 76%)`,
              }}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: `hsl(${hue} 92% 62%)` }}
              />
              Acum
            </span>
            <span className="font-mono text-[12px] tabular-nums tracking-wide text-ink-muted">
              {formatClock(now.start)} — {formatClock(now.end)}
            </span>
            {endsIn !== null && endsIn > 0 && (
              <span className="text-[12px] text-ink-faint">
                până la {formatClock(now.end)} · {formatDuration(endsIn)} rămași
              </span>
            )}
          </div>

          <ProgressLine value={schedule.progress} hue={hue} className="mt-3" />
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            În curând
          </span>
          <span className="text-[12px] text-ink-faint">
            Nimic în aer la această oră.
          </span>
        </div>
      )}

      {next.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            Urmează
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {next.map((programme, index) => (
              <li
                key={`${programme.start}-${programme.title}-${index}`}
                className="flex min-w-0 items-baseline gap-2"
              >
                <span className="font-mono text-[11px] tabular-nums text-white/80">
                  {formatClock(programme.start)}
                </span>
                <span className="truncate text-[13px] text-ink-muted">
                  {programme.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export type WhatsOnProps<C extends GuideChannelLike = GuideChannelLike> = {
  /** The programmes worth showing. */
  highlights: EpgHighlight<C>[];
  /** Plays a channel when its card is pressed. */
  onPlay?: (channel: C) => void;
  /** The day the guide covers, as the source prints it ("2026-10-22"). */
  date?: string | null;
  className?: string;
};

/**
 * The "ce e acum" rail: what is on across the channels the guide
 * covers, with the time it runs and how far into it we are.
 */
export function WhatsOn<C extends GuideChannelLike = GuideChannelLike>({
  highlights,
  onPlay,
  date,
  className,
}: WhatsOnProps<C>) {
  if (highlights.length === 0) return null;

  const day = formatGuideDate(date);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
            Ce e acum
            {day && (
              <>
                <span aria-hidden className="text-signal/40">
                  ·
                </span>
                <span className="text-ink-faint normal-case tracking-normal">
                  {day}
                </span>
              </>
            )}
          </p>
          <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-ink sm:text-[26px]">
            Ce rulează acum pe canalele {SITE_NAME}
          </h2>
        </div>
        <p className="text-[13px] text-ink-faint">
          {highlights.filter((h) => h.onNow).length} în aer · următorulele începând
          cu 4 ore
        </p>
      </div>

      <ul className="mask-edges mt-5 flex gap-3.5 overflow-x-auto pb-2 fx-hide-scrollbar">
        {highlights.map((highlight) => (
          <HighlightCard
            key={`${highlight.channel.slug}-${highlight.programme.start}-${highlight.programme.title}`}
            highlight={highlight}
            onPlay={onPlay}
          />
        ))}
      </ul>
    </div>
  );
}

function HighlightCard<C extends GuideChannelLike>({
  highlight,
  onPlay,
}: {
  highlight: EpgHighlight<C>;
  onPlay?: (channel: C) => void;
}) {
  const { channel, programme, onNow } = highlight;
  const catalogue = highlight.catalogue;
  const playable = Boolean(catalogue && onPlay);

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <ChannelMark channel={channel} catalogue={catalogue} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {channel.name}
        </span>
        {onNow ? (
          <span className="shrink-0 rounded-full border border-white/16 bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink/85">
            Acum
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-signal/85">
            {formatClock(programme.start)}
          </span>
        )}
      </div>

      <p className="mt-3 line-clamp-2 min-h-[2.6rem] font-display text-[15px] font-semibold leading-[1.35] tracking-[-0.01em] text-ink">
        {programme.title}
      </p>

      <p className="mt-1.5 font-mono text-[11px] tabular-nums tracking-wide text-ink-faint">
        {formatClock(programme.start)} — {formatClock(programme.end)}
      </p>

      <ProgressLine
        value={onNow ? highlight.progress : 0}
        hue={highlight.hue}
        className="mt-3"
        muted={!onNow}
      />
    </>
  );

  const shell =
    "block w-[250px] rounded-[18px] border border-white/[0.07] bg-white/[0.035] p-3.5 text-left backdrop-blur-md transition-[transform,border-color,background-color] duration-300 ease-spring sm:w-[264px]";

  return (
    <li className="shrink-0">
      {playable ? (
        <button
          type="button"
          onClick={() => onPlay?.(catalogue as C)}
          aria-label={`Vizionează ${channel.name} — ${programme.title}`}
          className={cn(
            shell,
            "fx-lift cursor-pointer hover:border-white/16 hover:bg-white/[0.07]",
          )}
        >
          {body}
        </button>
      ) : (
        <div className={shell}>{body}</div>
      )}
    </li>
  );
}

/** The channel's mark: its logo when it has one, its initial when it does not. */
function ChannelMark({
  channel,
  catalogue,
}: {
  channel: EpgChannel;
  catalogue: GuideChannelLike | null;
}) {
  const logo = catalogue?.logo ?? (channel.logo?.startsWith("/") ? channel.logo : null);
  const initial = (channel.name || "?").trim().charAt(0).toUpperCase();

  const tile =
    "relative grid h-7 w-12 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-white/12 bg-white/[0.06] font-display text-[11px] font-bold text-ink-muted";

  if (!logo) {
    return (
      <span aria-hidden className={tile}>
        {initial}
      </span>
    );
  }

  return (
    <span aria-hidden className={tile}>
      {initial}
      <Image
        src={logo}
        alt=""
        width={48}
        height={28}
        unoptimized
        className="absolute inset-0 h-full w-full object-cover opacity-95"
        onError={(event) => {
          // A logo the catalogue points at but does not ship: the initial
          // underneath takes over.
          event.currentTarget.style.opacity = "0";
        }}
      />
    </span>
  );
}

/** A hair-thin line showing how far into a slot we are. */
function ProgressLine({
  value,
  hue,
  className,
  muted = false,
}: {
  value: number;
  hue: number;
  className?: string;
  muted?: boolean;
}) {
  const width = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cn(
        "relative h-[3px] w-full overflow-hidden rounded-full bg-white/[0.09]",
        className,
      )}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
        style={{
          width: `${width}%`,
          background: muted
            ? "rgb(255 255 255 / 0.22)"
            : `linear-gradient(90deg, hsl(${hue} 85% 46%), hsl(${hue} 95% 68%))`,
          boxShadow: muted
            ? "none"
            : `0 0 14px hsl(${hue} 95% 60% / 0.55)`,
        }}
      />
    </div>
  );
}
