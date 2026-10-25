import type { EpgProgramme } from "@/components/now-next";
import type { Still } from "@/data/types";

/**
 * The still of the show on air.
 *
 * A still is a photograph of one broadcast, so it belongs to the programme
 * that was on air when it was taken. The capture pipeline files it under
 * that programme, the catalogue carries it, and the card picks the one that
 * matches the slot on air right now — which is what makes the picture
 * follow the schedule instead of being a still generic frame.
 *
 * The rule for a stale still is the same one the pipeline works by: a still
 * whose programme has ended is a picture of a show that is over. It is not
 * thrown away — it is the last thing the camera saw of that channel — but
 * it is never the picture of the show that is on now, and the pipeline
 * treats it as work to redo.
 */

/** The picture a card should put in its frame. */
export type Picture = {
  /** The still to show, when there is one. */
  still: Still | null;
  /** True when the still belongs to the programme on air right now. */
  current: boolean;
  /** True when the programme the still shows has ended. */
  stale: boolean;
};

/**
 * The still that belongs to a programme.
 *
 * A programme is identified by the moment it started: the same slot on the
 * same channel is one thing, whatever the capture called it.
 */
export function stillForProgramme(
  stills: readonly Still[] | null | undefined,
  programme: EpgProgramme | null | undefined,
): Still | null {
  if (!stills || stills.length === 0 || !programme) return null;
  for (const still of stills) {
    if (still.programme && still.programme.startsAt === programme.start) {
      return still;
    }
  }
  return null;
}

/** The newest still of a channel: the last thing the pipeline saw. */
export function latestStill(
  stills: readonly Still[] | null | undefined,
): Still | null {
  if (!stills || stills.length === 0) return null;
  return stills[0];
}

/**
 * True when the still shows a programme that has ended.
 *
 * A still with no programme cannot go stale: there is nothing to compare it
 * against, and it is a picture of the channel rather than of a slot.
 */
export function isStale(still: Still | null, moment: number): boolean {
  if (!still || !still.programme) return false;
  return moment >= still.programme.endsAt;
}

/**
 * The picture for a card.
 *
 * The still of the programme on air, when the pipeline has captured it.
 * Otherwise the newest still of the channel: a real picture of the channel
 * beats a gradient, and the pipeline will replace it. Either way the card
 * knows whether the picture is the show on air or the last thing it saw.
 */
export function pictureFor(
  stills: readonly Still[] | null | undefined,
  programme: EpgProgramme | null | undefined,
  moment: number,
): Picture {
  if (!stills || stills.length === 0) {
    return { still: null, current: false, stale: false };
  }

  const current = stillForProgramme(stills, programme);
  if (current) return { still: current, current: true, stale: false };

  const newest = latestStill(stills);
  if (!newest) return { still: null, current: false, stale: false };

  return { still: newest, current: false, stale: isStale(newest, moment) };
}
