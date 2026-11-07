/**
 * What makes a review popular.
 *
 * The order of the popular-reviews section is a *blend*, not a count.
 * A raw count is the oldest review's prize: the first review ever written
 * keeps collecting reactions and never gives the throne up, so the
 * section would freeze into the first fortnight of the product and stay
 * there. Two signals fix that, and neither of them is allowed to win on
 * its own.
 *
 *   1. **Reaction weight.** Plex's set is three reactions and they are
 *      not the same size: clap 3, love 2, like 1. A review everybody
 *      clapped is below one everybody loved, which is below one everybody
 *      liked. Weight is the first thing the blend reads, because a
 *      reaction is a visitor's vote and the size of it is their choice.
 *
 *   2. **Recency.** Television is a schedule. What a review is *about* is
 *      what was on when it was written, and it stays findable — but a
 *      verdict from three months ago is a colder signal than one from
 *      this week. Recency is a multiplier that halves the heat every
 *      fortnight, so an old review has to keep earning its place instead
 *      of sitting on a number it collected in its first week.
 *
 * The blend, in one line:
 *
 *   weight = log2(1 + score) + PRIOR        score = 3·clap + 2·love + 1·like
 *   heat   = weight × 2^(−ageDays / HALF_LIFE)
 *
 * Why the logarithm: the first reaction is worth more than the thirtieth.
 * Twenty claps are not twenty times the verdict of one, and without the
 * log a runaway review would still be immortal — it would just take
 * longer to get there.
 *
 * Why the PRIOR: a brand-new review has no reactions yet, and a section
 * that hides it until somebody reacts can never start reacting. A small
 * prior lets a review in for a few days on the strength of being new, and
 * after that it sinks below anything somebody actually reacted to. It
 * also means the tie-break is never arbitrary: an unreacted review goes
 * to the bottom of the reacted ones, and stays ordered by age.
 *
 * What this deliberately does *not* do: it does not rank by the raw
 * count, it does not keep a review alive forever, and it does not invent
 * a number. Nothing here is a counter a browser can write — it is the
 * order the server reads the rows in, and nothing more.
 */

/** A reaction, and how much it is worth. */
export const REACTION_WEIGHTS = {
  like: 1,
  love: 2,
  clap: 3,
} as const;

/**
 * The head start a review gets for being new.
 *
 * Sized so a fresh review outranks a reacted one for about a day, and a
 * week-old review with nothing on it sinks below one with a single like.
 */
const PRIOR = 0.35;

/** A review's heat halves every this many days. */
const HALF_LIFE_DAYS = 14;

/** A day, in the unit the age is measured in. */
const DAY_MS = 86_400_000;

/**
 * The heat of one review.
 *
 * `ageDays` is measured from `created_at`, never from when the review was
 * last reacted to: the schedule a review belongs to is the thing that
 * ages, not the traffic it happens to get.
 */
export function reviewHeat(
  score: number,
  ageDays: number,
  prior = PRIOR,
): number {
  const weight = Math.log2(1 + Math.max(0, score)) + prior;
  return weight * Math.pow(2, -Math.max(0, ageDays) / HALF_LIFE_DAYS);
}

/** The weighted score of a review's reactions: 3·clap + 2·love + 1·like. */
export function reactionScore(counts: {
  like: number;
  love: number;
  clap: number;
}): number {
  return (
    REACTION_WEIGHTS.clap * counts.clap +
    REACTION_WEIGHTS.love * counts.love +
    REACTION_WEIGHTS.like * counts.like
  );
}

/** The signals a review carries for the ranking. */
export type RankedReview = {
  counts: { like: number; love: number; clap: number };
  createdAt: string;
};

/**
 * The order the section is built in.
 *
 * Heat first, then age, then the id — so two renders of the same set give
 * the same list and the rail never reshuffles itself under a reader.
 */
export function byPopularity(
  a: RankedReview,
  b: RankedReview,
  now: number = Date.now(),
): number {
  const ageA = Math.max(0, (now - Date.parse(a.createdAt)) / DAY_MS);
  const ageB = Math.max(0, (now - Date.parse(b.createdAt)) / DAY_MS);

  const heatA = reviewHeat(reactionScore(a.counts), ageA);
  const heatB = reviewHeat(reactionScore(b.counts), ageB);

  if (heatA !== heatB) return heatB - heatA;
  if (ageA !== ageB) return ageB - ageA;
  return a.createdAt < b.createdAt ? 1 : -1;
}
