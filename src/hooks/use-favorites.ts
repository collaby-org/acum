"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "vizor:favourites:v1";

const EMPTY: string[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedIds: string[] = EMPTY;

function parse(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return EMPTY;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIds = parse(raw);
  }
  return cachedIds;
}

function getServerSnapshot(): string[] {
  return EMPTY;
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* private mode — favourites simply do not persist */
  }
  cachedRaw = null; // force the next snapshot read to pick the new value up
  for (const listener of listeners) listener();
}

/**
 * Favourites live entirely in the browser — no account, no server, no cookie.
 *
 * The list is read through `useSyncExternalStore` so the server render and the
 * first client render agree, and so changes from another tab are picked up.
 */
export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((id: string) => {
    const current = getSnapshot();
    const exists = current.includes(id);
    write(exists ? current.filter((x) => x !== id) : [...current, id]);
    return !exists;
  }, []);

  const set = useMemo(
    () => ({
      has: (id: string) => ids.includes(id),
      toggle,
      clear: () => write([]),
    }),
    [ids, toggle],
  );

  return { ids, set };
}
