/**
 * What is trending, right now.
 *
 * Two signals, in this order:
 *
 *   1. **Our own audience.** The proxy counts the browsers watching each
 *      channel over the last ninety seconds. When people are actually
 *      watching here, that is the trend — nothing is more current.
 *
 *   2. **The source's popularity counter.** The directories index a `views`
 *      number per channel. It is cumulative rather than live, so it is a
 *      ranking and nothing more, but it is the best signal available for a
 *      channel nobody of ours is watching yet.
 *
 * The two are never mixed: a live count is a live count, and a popularity
 * number is never dressed up as one.
 */
import type { Channel } from "@/data/types";

/** A channel with the signals it carries for the ranking. */
export type TrendSignals = {
  /** How many browsers are watching this channel here, right now. */
  live: number;
  /** The source's cumulative popularity counter. */
  views: number | null;
};

/** The signals of one channel, given the live audience map. */
export function signalsOf(
  channel: Pick<Channel, "id" | "views">,
  live: Record<string, number>,
): TrendSignals {
  return {
    live: live[channel.id] ?? 0,
    views: channel.views ?? null,
  };
}

/**
 * The order the trending rail is built in.
 *
 * Live audience first, then popularity, then the name — so the order is
 * stable and the same rail does not reshuffle itself between two renders.
 */
export function byTrending(
  a: Pick<Channel, "id" | "name" | "views">,
  b: Pick<Channel, "id" | "name" | "views">,
  live: Record<string, number>,
): number {
  const liveA = live[a.id] ?? 0;
  const liveB = live[b.id] ?? 0;
  if (liveA !== liveB) return liveB - liveA;
  const viewsA = a.views ?? 0;
  const viewsB = b.views ?? 0;
  if (viewsA !== viewsB) return viewsB - viewsA;
  return a.name.localeCompare(b.name, "ro");
}

/**
 * The channel the hero leads with: the one people are watching now.
 *
 * Our own audience wins — but only once it is a crowd. One visitor is not a
 * trend, and letting a single browser decide what the whole home page leads
 * with would be silly. Below the threshold, the popularity counter decides,
 * which is the closest thing to a national ratings table.
 *
 * A channel nobody can play is never chosen: the hero's first job is to work.
 */
export function pickTrending(
  channels: readonly Channel[],
  live: Record<string, number>,
  playable: (channel: Channel) => boolean,
  minLive = 3,
): Channel | null {
  const usable = channels.filter(playable);
  if (usable.length === 0) return null;

  const watched = usable
    .filter((channel) => (live[channel.id] ?? 0) >= minLive)
    .sort((a, b) => byTrending(a, b, live));
  if (watched.length > 0) return watched[0] ?? null;

  const popular = [...usable].sort((a, b) => byTrending(a, b, live));
  return popular[0] ?? null;
}
