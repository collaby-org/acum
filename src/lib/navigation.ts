/**
 * Navigation helpers — pure functions over the catalogue.
 *
 * The catalogue holds one entry per real channel; each channel carries the
 * upstream feeds ("servers") that carry it. Everything in this module works on
 * the shape declared in `src/data/types.ts` and knows nothing about React.
 */

import type { CategoryId, Quality, ServerStatus, Still } from "@/data/types";
import { normalize } from "@/lib/utils";

/**
 * The minimum a consumer needs to browse, search and index a channel.
 *
 * Deliberately structural: a channel is anything that carries an id, a name,
 * a family, a category, a logo and a status. The catalogue may grow fields;
 * navigation must not have to follow.
 */
export type ChannelLike = {
  id: string;
  name: string;
  family: string;
  familyKey: string;
  category: CategoryId;
  logo: string | null;
  logoRemote?: string | null;
  logoHd?: string | null;
  logoDark?: boolean;
  status: ServerStatus;
  quality?: Quality;
  servers?: readonly ServerLike[];
  /** How many people are watching right now, when a source counts them. */
  views?: number | null;
  /** A still of the show on air, when the catalogue ships one. */
  poster?: string | null;
  /**
   * The stills of the programmes in the guide's window, newest first. The
   * card picks the one that belongs to the programme on air right now.
   */
  stills?: readonly Still[];
};

/**
 * A feed, as far as navigation cares: it names itself and says how it is
 * doing. The upstream addresses are not part of it.
 */
export type ServerLike = {
  id: string;
  label: string;
  status?: ServerStatus;
  quality?: Quality;
  source?: "primary" | "secondary" | "canale-tv";
};

/* ------------------------------------------------------------------ *
 * Taxonomy
 * ------------------------------------------------------------------ */

/** The order categories are presented in, everywhere in the app. */
export const CATEGORY_ORDER: readonly CategoryId[] = [
  "generaliste",
  "stiri",
  "sport",
  "movies",
  "kids",
  "documentare",
  "music",
];

/** Human labels for the categories, mirroring the taxonomy. */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  generaliste: "Generaliste",
  stiri: "Știri",
  sport: "Sport",
  movies: "Filme",
  kids: "Copii",
  documentare: "Documentare",
  music: "Muzică",
};

export function categoryLabel(category: CategoryId): string {
  return CATEGORY_LABELS[category] ?? category;
}

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

/**
 * Match tiers, best first. A tier number is better than a bigger number.
 */
const TIER = {
  exact: 0,
  namePrefix: 1,
  nameWord: 2,
  nameInside: 3,
  familyPrefix: 4,
  familyInside: 5,
  category: 6,
} as const;

/**
 * How well a channel matches a query. Lower is better; `-1` means no match.
 *
 * Exact names win, then names that start with the query, then a word inside
 * the name, then the family, then the category.
 */
export function matchScore(channel: ChannelLike, query: string): number {
  const needle = normalize(query);
  if (!needle) return TIER.exact;

  const name = normalize(channel.name);
  if (name === needle) return TIER.exact;
  if (name.startsWith(needle)) return TIER.namePrefix;
  if (name.split(/\s+/).some((word) => word.startsWith(needle))) {
    return TIER.nameWord;
  }
  if (name.includes(needle)) return TIER.nameInside;

  const family = normalize(channel.family);
  if (family.startsWith(needle)) return TIER.familyPrefix;
  if (family.includes(needle)) return TIER.familyInside;

  if (normalize(categoryLabel(channel.category)).includes(needle)) {
    return TIER.category;
  }

  return -1;
}

/** True when the channel matches the query. An empty query matches every channel. */
export function matchesQuery(channel: ChannelLike, query: string): boolean {
  return matchScore(channel, query) >= 0;
}

/**
 * The channels that match the query, best match first.
 *
 * Ties break on the shorter name, then alphabetically — "Antena 1" before
 * "Antena 1 HD".
 */
export function rankResults<T extends ChannelLike>(
  channels: readonly T[],
  query: string,
): T[] {
  const needle = normalize(query);
  if (!needle) return sortChannels(channels);

  return channels
    .map((channel) => ({ channel, score: matchScore(channel, needle) }))
    .filter((entry) => entry.score >= 0)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.channel.name.length - b.channel.name.length ||
        a.channel.name.localeCompare(b.channel.name, "ro"),
    )
    .map((entry) => entry.channel);
}

/* ------------------------------------------------------------------ *
 * Grouping and sorting
 * ------------------------------------------------------------------ */

export type ChannelGroup<T> = {
  id: CategoryId;
  label: string;
  channels: T[];
};

/**
 * Group channels by category, categories in taxonomy order, empty groups
 * dropped. Labels come from the catalogue taxonomy when one is supplied.
 */
export function groupByCategory<T extends ChannelLike>(
  channels: readonly T[],
  categories?: readonly { id: CategoryId; label: string }[],
): ChannelGroup<T>[] {
  const labels = new Map<CategoryId, string>(
    categories?.map((category) => [category.id, category.label]) ?? [],
  );

  const buckets = new Map<CategoryId, T[]>();
  for (const channel of channels) {
    const bucket = buckets.get(channel.category);
    if (bucket) bucket.push(channel);
    else buckets.set(channel.category, [channel]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b))
    .map(([id, list]) => ({
      id,
      label: labels.get(id) ?? categoryLabel(id),
      channels: list,
    }));
}

function categoryRank(category: CategoryId): number {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

/** Alphabetical order, diacritics-insensitive. */
export function sortChannels<T extends ChannelLike>(channels: readonly T[]): T[] {
  return [...channels].sort(compareNames);
}

function compareNames(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, "ro", { sensitivity: "base" });
}

/* ------------------------------------------------------------------ *
 * Alphabet index
 * ------------------------------------------------------------------ */

/** The bucket a name belongs to: a letter, the digits, or the odd signs. */
export function bucketKey(name: string): string {
  const first = normalize(name).charAt(0);
  if (!first) return "#";
  if (/\d/.test(first)) return "0-9";
  if (/[a-z]/.test(first)) return first.toUpperCase();
  return "#";
}

export type AlphabetBucket<T> = {
  /** "A" … "Z", "0-9" or "#". */
  key: string;
  /** What the button shows: "A" or "0–9". */
  label: string;
  channels: T[];
};

/**
 * The letters that actually exist in the catalogue, each with the channels
 * under it in alphabetical order. Letters with no channels are simply absent.
 */
export function alphabetBuckets<T extends ChannelLike>(
  channels: readonly T[],
): AlphabetBucket<T>[] {
  const buckets = new Map<string, T[]>();
  for (const channel of channels) {
    const key = bucketKey(channel.name);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(channel);
    else buckets.set(key, [channel]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => bucketRank(a) - bucketRank(b))
    .map(([key, list]) => ({
      key,
      label: key === "0-9" ? "0–9" : key,
      channels: [...list].sort(compareNames),
    }));
}

function bucketRank(key: string): number {
  if (key === "0-9") return -1;
  if (key === "#") return 99;
  return key.charCodeAt(0) - 64;
}

/**
 * The position of the first channel of every bucket, keyed by bucket.
 * Useful to jump straight to a letter inside an already sorted list.
 */
export function channelIndex<T extends ChannelLike>(
  channels: readonly T[],
): Map<string, number> {
  const index = new Map<string, number>();
  channels.forEach((channel, position) => {
    const key = bucketKey(channel.name);
    if (!index.has(key)) index.set(key, position);
  });
  return index;
}
