"use client";

/**
 * The frame the browser is already decoding.
 *
 * A visitor watching a channel has the decoded picture in a `<video>`
 * element, one `drawImage` away from being a JPEG. That frame is the most
 * honest still there is: it is what a person actually saw. This hook takes
 * it, files it under the slot on air, and never asks anybody anything —
 * the address is derived from the slot, so the card that shows it later
 * finds it by predicting where it is.
 *
 * What it does *not* do is take a frame of anything but a live picture.
 * A card's picture follows the schedule, so a frame of a stalled stream, a
 * joining slate or a channel that is not really on air would be a lie that
 * outlives the lie: the file is public and permanent, and the next visitor
 * would see it. So the guards below are the point of the hook, not the
 * plumbing around it:
 *
 *   - nothing is drawn while the picture is paused, or before there is a
 *     decoded frame at all (`readyState`, `videoWidth`) — which is also
 *     what a *blocked* or *bare* upstream looks like from here,
 *   - nothing is drawn while the tab is behind another window,
 *   - an `<iframe>` embed has no `<video>` in our document, so there is no
 *     ref and nothing to draw: an embed is not a picture we may read,
 *   - the wait is counted in the picture's own clock, so a stream that
 *     stalls has not "played two seconds",
 *   - one capture per slot per tab, and the bucket is asked once per slot
 *     per session before the wait even starts — a frame that is already
 *     filed is not taken again.
 *
 * The player owns the `<video>` and the channel, and the wiring belongs to
 * whoever owns that file. This hook wants three things from it — the ref,
 * the catalogue id, and the slot on air — plus whether the picture is
 * actually playing.
 */
import { useEffect } from "react";
import type { RefObject } from "react";
import type { EpgProgramme } from "@/components/now-next";
import { getSupabaseClient } from "@/lib/supabase/client";
import { STILL_FRAME, stillKey, stillUrl, slotFor } from "@/lib/stills";

/**
 * How much playback passes before the frame is taken.
 *
 * Two seconds in, the joining slate is gone and the broadcast bug is
 * settled. One second is not enough to be sure; a whole programme is too
 * long to wait for a thumbnail nobody is waiting on.
 */
const CAPTURE_AFTER_SECONDS = 2;

/** How often the wait looks at the picture. */
const POLL_MS = 150;

/**
 * The ceiling on the wait, in wall-clock time.
 *
 * A picture that keeps stalling has not played two seconds, but the wait
 * cannot outlive the tab's patience for it either.
 */
const WAIT_CEILING_MS = 30_000;

/** What a frame is filed as. */
const JPEG_QUALITY = 0.72;

/** How long the upload may take before the hook gives up on it. */
const SEND_TIMEOUT_MS = 20_000;

/**
 * The slots this tab has already drawn a frame for.
 *
 * One capture per slot per tab: the key is the identity of the frame, so a
 * second draw of the same slot has nothing left to say — and a tab that
 * re-renders while a stream reconnects must not file the same still twice.
 */
const filed = new Set<string>();

/**
 * The slots this tab has already asked the bucket about.
 *
 * Once per slot per session, so a page with the same channel in three
 * rails costs one HEAD and not three.
 */
const asked = new Map<string, boolean>();

export type StillCaptureOptions = {
  /** The element the picture is being decoded into. */
  video: RefObject<HTMLVideoElement | null>;
  /** The catalogue id of the channel being watched. */
  channelId: string;
  /** The slot on air right now. The still is filed under its start. */
  programme: EpgProgramme | null;
  /** True while the picture is actually on screen. */
  playing: boolean;
  /** How much playback passes before the frame is drawn. Default 2. */
  afterSeconds?: number;
};

/**
 * True when there is a decoded frame to take and the picture is on screen.
 *
 * This is where the blocked, the bare and the paused all give the same
 * answer: an upstream that refused, a feed that never produced a frame and
 * a visitor who pressed pause are, from here, three ways of having no
 * picture — and a still is a photograph of a picture.
 */
function ready(video: HTMLVideoElement): boolean {
  return (
    !video.paused &&
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    video.videoHeight > 0 &&
    (typeof document === "undefined" ||
      document.visibilityState !== "hidden")
  );
}

/**
 * Ask the bucket whether the slot's frame is already filed.
 *
 * A HEAD on the address the card would load anyway. Anything other than a
 * straight "yes" is read as "not there", because a missing object and a
 * bucket that hiccuped look identical from here — and the capture is what
 * fixes both.
 */
async function probe(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Draw one frame of the picture, resized as it comes out.
 *
 * The destination rect does the resizing, so the browser never hands back
 * a 1080p frame to be scaled afterwards: 640×360 of JPEG, whatever the
 * feed is. A picture the browser is not allowed to read — a cross-origin
 * frame with no CORS — cannot be drawn at all, and the answer is no still
 * rather than a broken one.
 */
async function frameOf(video: HTMLVideoElement): Promise<Blob | null> {
  if (!ready(video)) return null;

  const canvas = document.createElement("canvas");
  canvas.width = STILL_FRAME.width;
  canvas.height = STILL_FRAME.height;

  const context = canvas.getContext("2d");
  if (!context) return null;

  try {
    context.drawImage(
      video,
      0,
      0,
      STILL_FRAME.width,
      STILL_FRAME.height,
    );
  } catch {
    return null;
  }

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });
}

/** File the frame under its slot, and say whether it landed. */
async function file(input: {
  channelId: string;
  slot: number;
  blob: Blob;
}): Promise<boolean> {
  let token: string | null = null;
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    token = data.session?.access_token ?? null;
  } catch {
    return false;
  }

  // The route is signed-in only. A visitor with no session files nothing:
  // a still is not worth an account the browser does not have.
  if (!token) return false;

  const body = new FormData();
  body.set("channel", input.channelId);
  body.set("slot", String(input.slot));
  body.set("file", input.blob, `${input.channelId}-${input.slot}.jpg`);

  try {
    const response = await fetch("/api/stills", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Capture the frame of the slot on air, once, when there is none yet.
 *
 * The whole capture lives in one effect with one `disposed` flag, so
 * unmounting the player or moving to the next programme tears down the
 * wait in flight rather than letting it finish into a slot that is over.
 * A slot that has already been filed — here or in another tab — is
 * skipped before the wait starts, so the two-second delay costs nothing
 * when there is nothing to do.
 */
export function useStillCapture({
  video,
  channelId,
  programme,
  playing,
  afterSeconds = CAPTURE_AFTER_SECONDS,
}: StillCaptureOptions): void {
  // A primitive, so a guide that hands back a new object every minute does
  // not restart a capture that is already under way.
  const slot = slotFor(programme);

  useEffect(() => {
    const at = slot;
    if (!playing || !channelId || at === null) return;

    const key = stillKey(channelId, at);
    const url = stillUrl(channelId, at);
    if (!key || !url) return;
    if (filed.has(key)) return;

    let disposed = false;
    let timer = 0;

    const stop = () => {
      disposed = true;
      if (timer !== 0) window.clearInterval(timer);
      timer = 0;
    };

    void (async () => {
      // 1. The bucket may already hold this frame.
      const seen = asked.get(key);
      if (seen === true) return;
      if (seen === undefined) {
        const present = await probe(url);
        if (disposed) return;
        asked.set(key, present);
        if (present) return;
      }

      const element = video.current;
      if (!element) return;

      // 2. Two seconds of the picture, not two seconds of waiting.
      const from = element.currentTime;
      const started = Date.now();
      await new Promise<void>((resolve) => {
        timer = window.setInterval(() => {
          if (disposed) {
            window.clearInterval(timer);
            timer = 0;
            resolve();
            return;
          }
          // A paused, hidden or stalled picture is not playback: the wait
          // is not counted against the wall clock, and nothing is drawn.
          if (!ready(element)) return;
          if (
            element.currentTime - from >= afterSeconds ||
            Date.now() - started > WAIT_CEILING_MS
          ) {
            window.clearInterval(timer);
            timer = 0;
            resolve();
          }
        }, POLL_MS);
      });
      if (disposed) return;

      // 3. One frame.
      const blob = await frameOf(element);
      if (disposed || !blob) return;

      // Filed before it is sent: the key is the identity of the frame, and
      // a re-render must not draw the same one twice while it uploads.
      filed.add(key);

      // 4. Put it where the card already knows to look.
      await file({ channelId, slot: at, blob });
    })();

    return stop;
  }, [video, channelId, slot, playing, afterSeconds]);
}
