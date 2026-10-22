"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { migrateStorageKey } from "@/lib/utils";

const FAVOURITES_KEY = "acum:favourites:v1";
const RECENT_KEY = "acum:recent:v1";
const RECENT_LIMIT = 12;

/**
 * The shelves were called `vizor:` before the product was renamed. The
 * visitor's pins and their history move across with them.
 */
migrateStorageKey("vizor:favourites:v1", FAVOURITES_KEY);
migrateStorageKey("vizor:recent:v1", RECENT_KEY);

const EMPTY: string[] = [];

/**
 * A tiny external store over `localStorage`.
 *
 * `useSyncExternalStore` is the right primitive here: the server render and
 * the first client render must agree (there is no session, so the server
 * always sees an empty list), and a change in another tab has to show up
 * without a reload.
 */
function createStore(key: string) {
  let cachedRaw: string | null = null;
  let cachedValue: string[] = EMPTY;
  const listeners = new Set<() => void>();

  function read(): string[] {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return EMPTY;
    }
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      cachedValue = Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string")
        : EMPTY;
    } catch {
      cachedValue = EMPTY;
    }
    return cachedValue;
  }

  function write(next: string[]) {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* private mode — the list simply does not persist */
    }
    cachedRaw = null;
    for (const listener of listeners) listener();
  }

  return {
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    read,
    write,
  };
}

const favourites = createStore(FAVOURITES_KEY);
const recent = createStore(RECENT_KEY);

export function useFavourites() {
  const ids = useSyncExternalStore(
    favourites.subscribe,
    favourites.read,
    () => EMPTY,
  );

  const toggle = useCallback((id: string) => {
    const current = favourites.read();
    const exists = current.includes(id);
    favourites.write(
      exists ? current.filter((x) => x !== id) : [...current, id],
    );
    return !exists;
  }, []);

  const set = useMemo(
    () => ({
      has: (id: string) => ids.includes(id),
      toggle,
      clear: () => favourites.write([]),
    }),
    [ids, toggle],
  );

  return { ids, set };
}

/** The channels opened most recently, newest first. */
export function useRecentlyWatched() {
  const ids = useSyncExternalStore(recent.subscribe, recent.read, () => EMPTY);

  const remember = useCallback((id: string) => {
    const current = recent.read().filter((x) => x !== id);
    recent.write([id, ...current].slice(0, RECENT_LIMIT));
  }, []);

  const clear = useCallback(() => recent.write([]), []);

  return { ids, remember, clear };
}
