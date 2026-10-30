import type { EpgProgramme } from "@/components/now-next";
import type { Still } from "@/data/types";
import { SUPABASE_URL } from "@/lib/supabase/client";

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

/* ------------------------------------------------------------------ *
 * The live frame
 *
 * The still above is carried by the catalogue: it is scraped once, filed,
 * and shipped with the app. The one below is taken by whoever is watching.
 * A browser that is already decoding a channel has the frame in its hands,
 * and the only thing keeping it out of the next visitor's card is that
 * nobody wrote it down.
 *
 * So the frame is filed the moment it is taken, and filed *somewhere the
 * card already knows*: the slot decides the address, and the address is a
 * string both sides can build without asking anybody. That is the whole
 * trick — a card that wants the picture of the show on air computes where
 * the frame would be and tries it. No read, no index, no query, and a card
 * that arrives before the capture simply gets a 404 and paints its wash.
 * ------------------------------------------------------------------ */

/**
 * The bucket the live frames are filed in.
 *
 * It is public: a frame of a broadcast is not a secret, and a card must be
 * able to ask for it with the same credentials the page was served with.
 */
export const STILLS_BUCKET = "stills";

/** The most the bucket will hold: 256 KB, and the route says so first. */
export const STILL_MAX_BYTES = 256 * 1024;

/**
 * The size a frame is filed at.
 *
 * 16:9, and small enough that a card is never the reason a page is slow.
 * The frame is resized as it is drawn out of the video — a 1080p feed
 * costs 640×360 of JPEG and not one byte more.
 */
export const STILL_FRAME = { width: 640, height: 360 } as const;

/** The window a slot may fall in: this millennium, in epoch milliseconds. */
const SLOT_WINDOW = { from: Date.UTC(2020, 0, 1), to: Date.UTC(2100, 0, 1) };

/** A channel id that is one safe segment of an object key. */
const CHANNEL_SEGMENT = /^[a-z0-9][a-z0-9-]{0,63}$/i;

/**
 * The slot a timestamp names, when it names one.
 *
 * A slot is the moment a programme started, in epoch milliseconds — the
 * same number on both sides of the wire, so it crosses as text without
 * losing anything. A number that is not in the window is not a slot: a
 * clock that jumped, or a value somebody typed into a console.
 */
export function readSlot(value: unknown): number | null {
  const at =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(at)) return null;

  const slot = Math.floor(at);
  if (slot < SLOT_WINDOW.from || slot > SLOT_WINDOW.to) return null;
  return slot;
}

/**
 * The object a slot's frame is filed under: `stills/<channelId>/<slot>.jpg`.
 *
 * One frame per programme per channel, so the same slot always means the
 * same object — in this tab, in the next tab, in the next visitor's
 * browser. The capture writes over it without ceremony (`upsert`), because
 * a second frame of the same broadcast is the same picture.
 */
export function stillKey(channelId: string, slot: unknown): string | null {
  if (typeof channelId !== "string" || !CHANNEL_SEGMENT.test(channelId)) {
    return null;
  }

  const at = readSlot(slot);
  if (at === null) return null;

  return `${STILLS_BUCKET}/${channelId}/${at}.jpg`;
}

/**
 * Where the slot's frame is, on the public bucket.
 *
 * Computed and never read: a card that knows the slot knows the address,
 * so nothing has to be looked up for the picture to appear. `null` when
 * there is no slot to name or the project has no address — a card with no
 * address has nothing to predict, and paints its wash like it always did.
 */
export function stillUrl(channelId: string, slot: unknown): string | null {
  const key = stillKey(channelId, slot);
  if (!key || !SUPABASE_URL) return null;

  return `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/${key}`;
}

/**
 * The slot a programme's frame is filed under: the moment it started.
 *
 * The card and the capture both go through here, so the frame a visitor
 * files is the frame the next card asks for — the schedule is the only
 * thing that has to agree between them.
 */
export function slotFor(
  programme: EpgProgramme | null | undefined,
): number | null {
  if (!programme) return null;
  return readSlot(programme.start);
}
