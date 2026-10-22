"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * The clock the programme guide is read against.
 *
 * The guide is a file. It says what is on between two absolute timestamps
 * and it says nothing about the present, so "what is on now" is a question
 * about the clock — and a clock is the one thing a page cannot take for
 * granted. A tab opened at 12:00 and left alone until 13:30 would go on
 * naming the show that ended at 12:59.
 *
 * So the clock lives here, once, and everybody reads the same one:
 *
 *   - the cards, the hero and the channel panel all ask this store for the
 *     moment the guide is resolved against;
 *   - the store ticks once a minute, because the guide's own resolution is
 *     the minute;
 *   - the tick lands just after the minute turns over, so a programme that
 *     ends at 12:59 is replaced within a second of 13:00.
 *
 * The browser's own clock is corrected by the server's. The page is rendered
 * per request and the guide carries the server's stamp for that request, so
 * the difference between the two clocks is known, and it is taken out: the
 * page never claims a programme that has not started yet, and a visitor whose
 * computer is five minutes out is still told the truth.
 */

/** The guide's own resolution: the minute. */
const TICK_MS = 60_000;

/**
 * How far the browser's clock may be from the server's before the server's
 * stamp is refused as a clock.
 *
 * Beyond this the stamp is not a render stamp but the guide's own snapshot —
 * the moment the file was written — and correcting against it would move the
 * page away from the present by however old the file is.
 */
const MAX_SKEW_MS = 12 * 60 * 60_000;

type Listener = () => void;

const listeners = new Set<Listener>();

/** The correction between the browser's clock and the server's. */
let offset = 0;

/**
 * The moment the store holds.
 *
 * It starts at the browser's own clock; the server's stamp arrives a moment
 * later and corrects it.
 */
let snapshot = Date.now();

/** The interval that drives the tick, once the page has a reader. */
let timer: ReturnType<typeof setInterval> | null = null;

/** The one-shot timer that waits for the first minute to turn over. */
let pending: ReturnType<typeof setTimeout> | null = null;

/**
 * The moment the browser believes it is, corrected by the server's stamp.
 */
export function liveNow(): number {
  return Date.now() + offset;
}

/**
 * Take the browser's clock to the server's.
 *
 * The stamp is the moment the server rendered the page, so the difference
 * between it and the browser's clock is the difference between the two
 * clocks plus the time the page spent in transit. Correcting for it keeps
 * the page on the same minute as the guide.
 */
export function anchorClock(stamp: number | null | undefined): void {
  if (typeof stamp !== "number" || !Number.isFinite(stamp) || stamp <= 0) {
    return;
  }
  if (Math.abs(stamp - Date.now()) > MAX_SKEW_MS) return;
  offset = stamp - Date.now();
}

/** Take a new reading and tell every reader about it. */
function publish(): void {
  snapshot = liveNow();
  for (const listener of listeners) listener();
}

function stop(): void {
  if (pending !== null) {
    clearTimeout(pending);
    pending = null;
  }
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Start the clock.
 *
 * The first tick waits for the minute to turn over and lands a moment after
 * it, so a programme that ends at 12:59 is replaced within a second of
 * 13:00 rather than up to a minute later. The interval that follows keeps
 * that phase.
 */
function start(): void {
  if (timer !== null || pending !== null) return;

  const delay = Math.max(0, TICK_MS - (liveNow() % TICK_MS)) + 250;
  pending = setTimeout(() => {
    pending = null;
    publish();
    timer = setInterval(publish, TICK_MS);
  }, delay);
}

/** Listen for the minute turning over. */
function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/** What the store holds. */
function getSnapshot(): number {
  return snapshot;
}

/**
 * The moment the guide is resolved against.
 *
 * The first reading is the server's stamp, so the server's markup and the
 * browser's first paint are the same thing — there is no flash of a
 * different programme while the page hydrates. From then on the store takes
 * over: the corrected clock, refreshed every minute.
 */
export function useGuideMoment(stamp: number | null | undefined): number {
  const getServerSnapshot = useCallback(() => stamp ?? 0, [stamp]);

  // The stamp arrives with the guide: the clock is corrected against it,
  // and the store takes its first reading.
  useEffect(() => {
    anchorClock(stamp);
    publish();
  }, [stamp]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * A counter that turns over once a minute.
 *
 * The things that are not resolved in the browser — the channel panel reads
 * its programme from the server — use it to know when to ask again.
 */
export function useMinuteTick(): number {
  const [tick, setTick] = useState(0);

  useEffect(
    () => subscribe(() => setTick((count) => count + 1)),
    [],
  );

  return tick;
}
