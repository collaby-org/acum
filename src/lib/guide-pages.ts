/**
 * The programme guide, read for the pages that show it.
 *
 * `data/epg.json` is 1.26 MB. It is read **once** per process and kept in a
 * module-level variable: the pages below ask for it on every render, and
 * re-reading a megabyte per request would be the slowest thing in the app.
 *
 * The browser never receives the file. Every page projects the guide down to
 * the slots it actually shows and passes that, and nothing else, to the
 * client.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  foldKey,
  matchGuideChannels,
  normalizeGuide,
  resolveSchedule,
  type EpgChannel,
  type EpgGuide,
  type EpgProgramme,
} from "@/components/now-next";
import type { Channel } from "@/data/types";

/* ------------------------------------------------------------------ *
 * Reading the guide
 * ------------------------------------------------------------------ */

/**
 * The moment of the request.
 *
 * The clock is read here rather than in the page: a render must be pure, and
 * "now" is a property of the request, not of the component. Every page that
 * shows what is on air asks for the moment once and passes it down.
 */
export function requestMoment(): number {
  return Date.now();
}

/** The guide, once it has been read and folded into the shape we use. */
let cached: EpgGuide | null = null;

/** The read in flight, so two pages rendering at once read the file once. */
let pending: Promise<EpgGuide> | null = null;

/**
 * The guide, read once and kept.
 *
 * A missing file is not a crash: the guide is a bonus on top of the
 * catalogue, and a page that shows a timetable must still render when the
 * timetable is not there.
 */
export async function getGuide(): Promise<EpgGuide> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    try {
      const raw = await readFile(
        path.join(process.cwd(), "data", "epg.json"),
        "utf8",
      );
      cached = normalizeGuide(JSON.parse(raw));
    } catch {
      cached = { date: null, reference: null, channels: [] };
    }
    pending = null;
    return cached;
  })();

  return pending;
}

/* ------------------------------------------------------------------ *
 * The calendar
 * ------------------------------------------------------------------ */

const BUCHAREST_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Bucharest",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Romanian calendar day a moment falls on: "2026-10-22". */
export function bucharestDay(moment: number): string {
  return BUCHAREST_DAY.format(new Date(moment));
}

/** The day after (or before) a Romanian calendar day. */
export function shiftDay(day: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const base = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const moved = new Date(base + delta * 86_400_000);
  return moved.toISOString().slice(0, 10);
}

/** The Romanian calendar day, written out: "joi, 22 octombrie 2026". */
export function dayLabel(day: string): string {
  const parsed = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return day;
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(parsed);
}

/** The Romanian weekday, short: "Joi". */
export function weekdayLabel(day: string): string {
  const parsed = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return day;
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "short",
    timeZone: "Europe/Bucharest",
  }).format(parsed);
}

/** A day the guide covers. */
export type GuideDay = {
  /** "2026-10-22". */
  date: string;
  /** "joi, 22 octombrie 2026". */
  label: string;
  /** "Joi". */
  weekday: string;
  /** How many slots the day holds. */
  programmes: number;
  /** How many channels have at least one slot that day. */
  channels: number;
  /** The first slot of the day, in epoch milliseconds. */
  first: number;
  /** The last slot of the day, in epoch milliseconds. */
  last: number;
  /** True when the day is today, in Romanian time. */
  isToday: boolean;
};

/**
 * The days the guide covers, in order.
 *
 * The guide is a rolling window, so the days are read off the slots
 * themselves rather than assumed: whatever the file holds is what the site
 * claims to know.
 */
export function guideDays(guide: EpgGuide, now = Date.now()): GuideDay[] {
  const today = bucharestDay(now);
  const byDay = new Map<string, GuideDay>();

  for (const channel of guide.channels) {
    for (const programme of channel.programmes) {
      const date = bucharestDay(programme.start);
      const day = byDay.get(date);
      if (day) {
        day.programmes += 1;
        if (programme.start < day.first) day.first = programme.start;
        if (programme.end > day.last) day.last = programme.end;
        continue;
      }
      byDay.set(date, {
        date,
        label: dayLabel(date),
        weekday: weekdayLabel(date),
        programmes: 1,
        channels: 0,
        first: programme.start,
        last: programme.end,
        isToday: date === today,
      });
    }
  }

  // A day can hold slots from channels that hold nothing else that day, so
  // the channel count is counted separately from the slot count.
  for (const channel of guide.channels) {
    const seen = new Set<string>();
    for (const programme of channel.programmes) {
      seen.add(bucharestDay(programme.start));
    }
    for (const date of seen) {
      const day = byDay.get(date);
      if (day) day.channels += 1;
    }
  }

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** The slots of one channel that fall on one day. */
export function programmesOn(
  channel: EpgChannel,
  day: string,
): EpgProgramme[] {
  return channel.programmes.filter(
    (programme) => bucharestDay(programme.start) === day,
  );
}

/** A catalogue channel and what the guide says about it. */
export type ScheduleEntry = {
  /** The catalogue channel, as the browser sees it. */
  channel: Channel;
  /** The guide channel it maps to. */
  guide: EpgChannel;
  /** The slot on air. */
  now: EpgProgramme | null;
  /** The slots that follow. */
  next: EpgProgramme[];
  /** How far we are through the current slot, 0..1. */
  progress: number;
  /** Minutes left of the current slot. */
  endsIn: number | null;
};

/**
 * The catalogue channels the guide covers, with what is on each of them.
 *
 * The guide is matched to the catalogue by slug, so a channel the guide
 * does not know about simply does not appear here — the page says how many
 * channels the guide covers rather than filling the gap with a guess.
 */
export function channelSchedules(
  guide: EpgGuide,
  channels: readonly Channel[],
  now: number,
): ScheduleEntry[] {
  const matched = matchGuideChannels(guide, channels);
  const entries: ScheduleEntry[] = [];

  for (const channel of channels) {
    const guideChannel = matched.get(channel.id);
    if (!guideChannel) continue;
    const schedule = resolveSchedule(guideChannel, now);
    entries.push({
      channel,
      guide: guideChannel,
      now: schedule.now,
      next: schedule.next,
      progress: schedule.progress,
      endsIn: schedule.endsIn,
    });
  }

  return entries;
}

/** The day a slot is on, for a catalogue of slots. */
export function groupByDay(
  guide: EpgGuide,
): Map<string, { channel: EpgChannel; programme: EpgProgramme }[]> {
  const groups = new Map<
    string,
    { channel: EpgChannel; programme: EpgProgramme }[]
  >();
  for (const channel of guide.channels) {
    for (const programme of channel.programmes) {
      const date = bucharestDay(programme.start);
      const bucket = groups.get(date);
      const entry = { channel, programme };
      if (bucket) bucket.push(entry);
      else groups.set(date, [entry]);
    }
  }
  for (const bucket of groups.values()) {
    bucket.sort(
      (a, b) =>
        a.programme.start - b.programme.start ||
        a.channel.name.localeCompare(b.channel.name, "ro"),
    );
  }
  return groups;
}

/* ------------------------------------------------------------------ *
 * Matches
 *
 * The guide carries no sport metadata: a slot is a title, a time and a
 * channel. A match is therefore recognised from the title — two sides
 * separated by a dash, on a sports channel — and the rule is written out
 * on the page, so the visitor knows exactly what the list is.
 * ------------------------------------------------------------------ */

/** Words that may sit inside a team name and stay lowercase. */
const NAME_WORDS = new Set([
  "de",
  "din",
  "și",
  "si",
  "masculin",
  "feminin",
]);

/** The sports channels, recognised from the guide's own name for them. */
const SPORTS = /sport|sport|arena|liga|tenis|baschet|fotbal|rugby|golf|formula|moto/i;

/** True when the guide channel is one that broadcasts sport. */
export function isSportsChannel(channel: EpgChannel): boolean {
  return SPORTS.test(channel.name) || SPORTS.test(channel.slug);
}

/** The trailing round marker a broadcaster writes after the two sides. */
const ROUND = /\s*\(?\s*(etapa|turul|runda|faza|seria|meciul)\s*\d*\s*\)?\s*$/i;

/** The live markers a broadcaster puts in front of a title. */
const LIVE_MARKER = /^(live|direct|în direct|in direct)\b[:\s-]*/i;

/** True when the title names a live broadcast. */
export function isLiveTitle(title: string): boolean {
  return LIVE_MARKER.test(title.trim());
}

/**
 * Two sides of a match, read out of a title.
 *
 * The dash is the separator. When it has spaces around it the split is
 * certain; when it has none, the split is made where a lowercase letter
 * meets an uppercase one — "Bihor Oradea-CSM Resita" is "Bihor Oradea"
 * and "CSM Resita", not "Bihor Oradea-CSM" and "Resita".
 */
function splitSides(text: string): [string, string] | null {
  const spaced = /^(.+?)\s+[-–—]\s+(.+)$/.exec(text);
  if (spaced) return [spaced[1].trim(), spaced[2].trim()];

  const tight = /^(.+?[a-zăâîșț])[-–—]([A-ZĂÂÎȘȚ].*)$/.exec(text);
  if (tight) return [tight[1].trim(), tight[2].trim()];

  return null;
}

/**
 * True when a piece of text reads like a name — a team, a squad — rather
 * than like a sentence.
 *
 * Every word starts with a capital or is one of the few lowercase words a
 * name is allowed to carry. "Finala individual compus masculin" is a
 * sentence and fails; "CS Ramnicu Valcea Baschet masculin Liga Nationala"
 * is a name and passes.
 */
function readsLikeAName(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6) return false;
  return words.every((word) => {
    if (/^\d+$/.test(word)) return true;
    if (/^[A-ZĂÂÎȘȚ]/.test(word)) return true;
    return NAME_WORDS.has(word.toLowerCase());
  });
}

/** A match, read out of the guide. */
export type Match = {
  /** The slot the match sits in. */
  programme: EpgProgramme;
  /** The channel that carries it. */
  channel: EpgChannel;
  /** The competition, when the title names one. */
  competition: string | null;
  /** The first side. */
  home: string;
  /** The second side. */
  away: string;
  /** True when the slot is on air right now. */
  onNow: boolean;
};

/**
 * The matches the guide holds.
 *
 * A slot is a match when it sits on a sports channel and its title names two
 * sides. Everything else is left out rather than guessed at.
 */
export function findMatches(guide: EpgGuide, now = Date.now()): Match[] {
  const matches: Match[] = [];

  for (const channel of guide.channels) {
    if (!isSportsChannel(channel)) continue;

    for (const programme of channel.programmes) {
      const title = programme.title.trim();
      const colon = title.indexOf(":");
      const head = colon > 0 ? title.slice(0, colon) : title;
      const body = colon > 0 ? title.slice(colon + 1) : title;

      const competition = colon > 0 ? head.replace(LIVE_MARKER, "").trim() : null;
      const sides = splitSides(body.replace(ROUND, "").trim());
      if (!sides) continue;
      if (!readsLikeAName(sides[0]) || !readsLikeAName(sides[1])) continue;

      matches.push({
        programme,
        channel,
        competition: competition && competition.length > 0 ? competition : null,
        home: sides[0],
        away: sides[1],
        onNow: now >= programme.start && now < programme.end,
      });
    }
  }

  return matches.sort(
    (a, b) => a.programme.start - b.programme.start || a.channel.name.localeCompare(b.channel.name, "ro"),
  );
}

/**
 * The live sport broadcasts that are not matches — a tournament, a live
 * tennis session, a final with no two sides.
 */
export function findLiveSport(
  guide: EpgGuide,
  now = Date.now(),
): { programme: EpgProgramme; channel: EpgChannel; onNow: boolean }[] {
  const found: { programme: EpgProgramme; channel: EpgChannel; onNow: boolean }[] = [];

  for (const channel of guide.channels) {
    if (!isSportsChannel(channel)) continue;
    for (const programme of channel.programmes) {
      if (!isLiveTitle(programme.title)) continue;
      found.push({
        programme,
        channel,
        onNow: now >= programme.start && now < programme.end,
      });
    }
  }

  return found.sort((a, b) => a.programme.start - b.programme.start);
}

/**
 * The sports the guide mentions, as it spells them.
 *
 * The page lists them so the visitor can see what the guide does cover —
 * and what it does not.
 */
export function sportsInGuide(guide: EpgGuide): string[] {
  const words = new Set<string>();
  const known = [
    "Fotbal",
    "Rugby",
    "Tenis",
    "Baschet",
    "Volei",
    "Handbal",
    "Gimnastică",
    "Atletism",
    "Moto",
    "Fotbal american",
  ];
  for (const channel of guide.channels) {
    if (!isSportsChannel(channel)) continue;
    for (const programme of channel.programmes) {
      for (const word of known) {
        if (programme.title.toLowerCase().includes(word.toLowerCase())) {
          words.add(word);
        }
      }
    }
  }
  return [...words].sort((a, b) => a.localeCompare(b, "ro"));
}

/* ------------------------------------------------------------------ *
 * The most-watched programmes
 *
 * There is no vote and no ratings table. What there is: the guide itself,
 * and the audience we measure for the channels that carry a programme. A
 * programme that several channels air at once, on channels people watch,
 * is the closest honest thing to "most watched" that the data supports.
 * ------------------------------------------------------------------ */

/** One programme in the ranking. */
export type RankedProgramme = {
  /** The title, as the broadcaster wrote it. */
  title: string;
  /** How many channels air it. */
  reach: number;
  /** The spectators we counted at the proxy, across the channels that air it. */
  liveViewers: number;
  /** The catalogue's cumulative popularity counter, across the same channels. */
  popularity: number;
  /** True when it is on air right now, on at least one channel. */
  onNow: boolean;
  /** The channel that carries it now. */
  onNowChannel: string | null;
  /** When it starts today, the first time it goes on air. */
  startsAt: number;
  /** The channels that air it. */
  channels: string[];
};

/**
 * The programmes the guide makes popular, ranked.
 *
 * The score is built from three things the site can actually measure:
 *
 *   - **reach** — how many channels air the same title,
 *   - **audience** — how many people are watching those channels,
 *   - **now** — whether the slot is on air at this moment.
 *
 * The two audience numbers are kept apart on purpose: the live count is
 * ours and moves minute to minute, the popularity counter is the
 * directory's and is cumulative. They are never added together and never
 * shown under the same label.
 */
export function rankProgrammes(
  guide: EpgGuide,
  live: Record<string, number>,
  popular: Record<string, number>,
  now = Date.now(),
): RankedProgramme[] {
  const groups = new Map<
    string,
    {
      title: string;
      channels: Set<string>;
      liveViewers: number;
      popularity: number;
      onNow: boolean;
      onNowChannel: string | null;
      startsAt: number;
    }
  >();

  for (const channel of guide.channels) {
    for (const programme of channel.programmes) {
      const key = foldKey(programme.title);
      if (!key) continue;

      let group = groups.get(key);
      if (!group) {
        group = {
          title: programme.title,
          channels: new Set<string>(),
          liveViewers: 0,
          popularity: 0,
          onNow: false,
          onNowChannel: null,
          startsAt: programme.start,
        };
        groups.set(key, group);
      }

      group.channels.add(channel.name);
      group.liveViewers += live[channel.name] ?? 0;
      group.popularity += popular[channel.name] ?? 0;
      if (programme.start < group.startsAt) group.startsAt = programme.start;

      if (now >= programme.start && now < programme.end && !group.onNow) {
        group.onNow = true;
        group.onNowChannel = channel.name;
      }
    }
  }

  const ranked: RankedProgramme[] = [...groups.values()].map((group) => ({
    title: group.title,
    reach: group.channels.size,
    liveViewers: group.liveViewers,
    popularity: group.popularity,
    onNow: group.onNow,
    onNowChannel: group.onNowChannel,
    startsAt: group.startsAt,
    channels: [...group.channels].sort((a, b) => a.localeCompare(b, "ro")),
  }));

  return ranked.sort(
    (a, b) =>
      Number(b.onNow) - Number(a.onNow) ||
      b.reach - a.reach ||
      b.liveViewers - a.liveViewers ||
      b.popularity - a.popularity ||
      a.startsAt - b.startsAt ||
      a.title.localeCompare(b.title, "ro"),
  );
}

/* ------------------------------------------------------------------ *
 * Projections for the browser
 *
 * The guide never crosses to the client whole. What crosses is a compact
 * index — a title, a start, an end, a channel — and nothing else.
 * ------------------------------------------------------------------ */

/** One slot, as the client receives it: [title, start, end]. */
export type Slot = [string, number, number];

/** One channel, as the client receives it. */
export type GuideChannelSummary = {
  /** The guide's own slug. */
  slug: string;
  /** The channel's name. */
  name: string;
  /** How many slots it has. */
  count: number;
};

/**
 * The whole guide as a compact index: the channels, and their slots.
 */
export function compactGuide(guide: EpgGuide): {
  channels: GuideChannelSummary[];
  slots: Record<string, Slot[]>;
} {
  const channels: GuideChannelSummary[] = [];
  const slots: Record<string, Slot[]> = {};

  for (const channel of guide.channels) {
    channels.push({
      slug: channel.slug,
      name: channel.name,
      count: channel.programmes.length,
    });
    slots[channel.slug] = channel.programmes.map((programme) => [
      programme.title,
      programme.start,
      programme.end,
    ]);
  }

  return { channels, slots };
}

/** A slot with the channel it belongs to, for the search page. */
export type SearchableSlot = {
  /** The title, as the broadcaster wrote it. */
  title: string;
  /** The channel that airs it. */
  channel: string;
  /** The channel's slug, so the result can link to the guide. */
  slug: string;
  /** Start, in epoch milliseconds. */
  start: number;
  /** End, in epoch milliseconds. */
  end: number;
};

/**
 * The programmes that air on the most channels on one day.
 *
 * A title that several channels carry at once is the day's clearest
 * signal — it is what the whole country watches.
 */
export function dayHighlights(
  guide: EpgGuide,
  day: string,
  limit = 8,
): { title: string; channels: string[]; onNow: boolean }[] {
  const groups = new Map<string, { title: string; channels: Set<string>; onNow: boolean }>();
  const now = Date.now();

  for (const channel of guide.channels) {
    for (const programme of programmesOn(channel, day)) {
      const key = foldKey(programme.title);
      if (!key) continue;
      let group = groups.get(key);
      if (!group) {
        group = { title: programme.title, channels: new Set<string>(), onNow: false };
        groups.set(key, group);
      }
      group.channels.add(channel.name);
      if (now >= programme.start && now < programme.end) group.onNow = true;
    }
  }

  return [...groups.values()]
    .filter((group) => group.channels.size > 1)
    .sort(
      (a, b) =>
        Number(b.onNow) - Number(a.onNow) ||
        b.channels.size - a.channels.size ||
        a.title.localeCompare(b.title, "ro"),
    )
    .slice(0, limit)
    .map((group) => ({
      title: group.title,
      channels: [...group.channels].sort((x, y) => x.localeCompare(y, "ro")),
      onNow: group.onNow,
    }));
}

/** Every slot in the guide, flattened for the search page. */
export function allSlots(guide: EpgGuide): SearchableSlot[] {
  const rows: SearchableSlot[] = [];
  for (const channel of guide.channels) {
    for (const programme of channel.programmes) {
      rows.push({
        title: programme.title,
        channel: channel.name,
        slug: channel.slug,
        start: programme.start,
        end: programme.end,
      });
    }
  }
  return rows.sort((a, b) => a.start - b.start);
}
