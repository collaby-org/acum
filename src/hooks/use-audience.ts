"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * How many people are watching, right now, on this site.
 *
 * The number comes from the proxy: every viewer asks for a segment every few
 * seconds, and the server counts the distinct browsers per channel. It is
 * refreshed once a minute — the stream itself is live, so a minute is close
 * enough to be true and far enough to be cheap.
 *
 * The count is shared by every component through a module-level store, the
 * same way the favourites are: one request, many readers.
 */

const EMPTY: Record<string, number> = {};

let snapshot: Record<string, number> = EMPTY;
let total = 0;
const listeners = new Set<() => void>();
let started = false;

function publish(live: Record<string, number>, nextTotal: number) {
  snapshot = live;
  total = nextTotal;
  for (const listener of listeners) listener();
}

async function refresh() {
  try {
    const response = await fetch("/api/audience", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      live?: Record<string, number>;
      total?: number;
    };
    publish(payload.live ?? {}, payload.total ?? 0);
  } catch {
    /* the count is a nicety, not a promise — a failure simply keeps the old one */
  }
}

function start() {
  if (started) return;
  started = true;
  void refresh();
  setInterval(() => void refresh(), 60_000);
}

/** The live audience of every channel that has one, by channel id. */
export function useLiveAudience(): {
  live: Record<string, number>;
  total: number;
} {
  useEffect(() => {
    start();
  }, []);

  const live = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => snapshot,
    () => EMPTY,
  );

  return { live, total };
}

/** How many browsers are watching one channel here, right now. */
export function liveViewers(live: Record<string, number>, id: string): number {
  return live[id] ?? 0;
}
