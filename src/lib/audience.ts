/**
 * The live audience of the app.
 *
 * Every viewer of a channel asks the proxy for a segment every few seconds,
 * and every one of those requests passes through here. Counting the distinct
 * viewers per channel over the last minute and a half gives a **real** number
 * of people watching a channel right now — ours, measured at the only place
 * where it can be measured truthfully.
 *
 * The directories we index publish a `views` counter, but it is cumulative:
 * sampled twice, seventy seconds apart, it had barely moved, and it reads
 * nine thousand for a channel whose own page shows three hundred. It is a
 * popularity ranking, and it is labelled as one everywhere it appears.
 *
 * The count lives in this process's memory. A deployment that runs more than
 * one instance would need a shared store; for a single process this is exact
 * and costs nothing.
 */

/** How long a viewer counts as present without asking for anything. */
const WINDOW_MS = 90_000;

/** channel id -> viewer id -> the moment the viewer was last seen. */
const viewers = new Map<string, Map<string, number>>();

/** The last time the whole map was swept. */
let lastSweep = Date.now();

/** Removes the viewers who have gone quiet. */
function sweep(now: number) {
  // A full sweep every half minute keeps the map from holding on to viewers
  // of channels nobody is watching any more.
  if (now - lastSweep < 30_000) return;
  lastSweep = now;
  for (const [channelId, audience] of viewers) {
    for (const [viewerId, seen] of audience) {
      if (now - seen > WINDOW_MS) audience.delete(viewerId);
    }
    if (audience.size === 0) viewers.delete(channelId);
  }
}

/**
 * Records that a viewer has just asked for something of this channel.
 *
 * The viewer id is a random value the client keeps for the session: it
 * identifies a browser, not a person, which is all the count needs to be.
 */
export function touchAudience(channelId: string, viewerId: string): void {
  if (!channelId || !viewerId) return;
  const now = Date.now();
  sweep(now);

  let audience = viewers.get(channelId);
  if (!audience) {
    audience = new Map<string, number>();
    viewers.set(channelId, audience);
  }
  audience.set(viewerId, now);
}

/** How many viewers are watching a channel right now. */
export function liveAudience(channelId: string): number {
  const audience = viewers.get(channelId);
  if (!audience) return 0;

  const now = Date.now();
  let count = 0;
  for (const seen of audience.values()) {
    if (now - seen <= WINDOW_MS) count += 1;
  }
  return count;
}

/** The live audience of every channel that has one, by channel id. */
export function liveAudienceMap(): Record<string, number> {
  const now = Date.now();
  const result: Record<string, number> = {};
  for (const [channelId, audience] of viewers) {
    let count = 0;
    for (const seen of audience.values()) {
      if (now - seen <= WINDOW_MS) count += 1;
    }
    if (count > 0) result[channelId] = count;
  }
  return result;
}

/** The total number of people watching anything, right now. */
export function totalAudience(): number {
  return Object.values(liveAudienceMap()).reduce((sum, n) => sum + n, 0);
}
