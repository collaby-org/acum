"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const PINNED_KEY = "vizor:pinned:v1";
const WATCH_LATER_KEY = "vizor:watch-later:v1";

/**
 * A pinned shelf is a row of shortcuts, not a library. A dozen is plenty —
 * beyond that the rail stops being a shortcut and becomes a second catalogue.
 */
export const PINNED_LIMIT = 12;

const EMPTY: string[] = [];

/**
 * A tiny external store over `localStorage`, the same shape as the favourites
 * store: a cached snapshot whose reference only changes when the stored value
 * changes, and a `write` that notifies every listener.
 *
 * `useSyncExternalStore` is the right primitive: the server render and the
 * first client render must agree (there is no session, so the server always
 * sees an empty shelf), and a change in another tab has to show up without a
 * reload.
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
      /* private mode — the shelf simply does not persist */
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

const pinnedStore = createStore(PINNED_KEY);
const watchLaterStore = createStore(WATCH_LATER_KEY);

/** A shelf with no order of its own — membership is all that matters. */
export type ShelfList = {
  /** The ids in the shelf, in shelf order. */
  ids: string[];
  has: (id: string) => boolean;
  /** Adds the id when it is missing, removes it when it is there. */
  toggle: (id: string) => boolean;
  clear: () => void;
};

/** The pinned shelf: an ordered list of shortcuts the user reorders by hand. */
export type PinnedShelf = ShelfList & {
  /** Appends the id to the end of the shelf. Fails when the shelf is full. */
  pin: (id: string) => boolean;
  /** Takes the id out of the shelf. */
  unpin: (id: string) => boolean;
  /**
   * Shifts the id by `delta` places — negative moves it towards the front of
   * the shelf, positive towards the back. The order of everything else is
   * preserved. Fails when the id is not pinned or the move leaves the shelf.
   */
  move: (id: string, delta: number) => boolean;
};

export type Shelves = {
  pinned: PinnedShelf;
  watchLater: ShelfList;
};

export function useShelves(): Shelves {
  const pinnedIds = useSyncExternalStore(
    pinnedStore.subscribe,
    pinnedStore.read,
    () => EMPTY,
  );
  const watchLaterIds = useSyncExternalStore(
    watchLaterStore.subscribe,
    watchLaterStore.read,
    () => EMPTY,
  );

  const pin = useCallback((id: string) => {
    const current = pinnedStore.read();
    if (current.includes(id)) return false;
    if (current.length >= PINNED_LIMIT) return false;
    pinnedStore.write([...current, id]);
    return true;
  }, []);

  const unpin = useCallback((id: string) => {
    const current = pinnedStore.read();
    if (!current.includes(id)) return false;
    pinnedStore.write(current.filter((x) => x !== id));
    return true;
  }, []);

  const togglePinned = useCallback(
    (id: string) => {
      if (pinnedStore.read().includes(id)) {
        unpin(id);
        return false;
      }
      return pin(id);
    },
    [pin, unpin],
  );

  const move = useCallback((id: string, delta: number) => {
    const current = pinnedStore.read();
    const from = current.indexOf(id);
    if (from === -1) return false;
    const to = from + delta;
    if (to < 0 || to >= current.length) return false;
    const next = [...current];
    next.splice(from, 1);
    next.splice(to, 0, id);
    pinnedStore.write(next);
    return true;
  }, []);

  const clearPinned = useCallback(() => pinnedStore.write([]), []);

  const toggleWatchLater = useCallback((id: string) => {
    const current = watchLaterStore.read();
    const exists = current.includes(id);
    watchLaterStore.write(
      exists ? current.filter((x) => x !== id) : [...current, id],
    );
    return !exists;
  }, []);

  const clearWatchLater = useCallback(() => watchLaterStore.write([]), []);

  const pinned = useMemo<PinnedShelf>(
    () => ({
      ids: pinnedIds,
      has: (id) => pinnedIds.includes(id),
      toggle: togglePinned,
      pin,
      unpin,
      move,
      clear: clearPinned,
    }),
    [pinnedIds, togglePinned, pin, unpin, move, clearPinned],
  );

  const watchLater = useMemo<ShelfList>(
    () => ({
      ids: watchLaterIds,
      has: (id) => watchLaterIds.includes(id),
      toggle: toggleWatchLater,
      clear: clearWatchLater,
    }),
    [watchLaterIds, toggleWatchLater, clearWatchLater],
  );

  return { pinned, watchLater };
}

/**
 * Resolves shelf ids against the catalogue, keeping the shelf order and
 * dropping the ids that no longer point at a channel.
 */
export function resolveShelf<T extends { id: string }>(
  ids: readonly string[],
  channels: readonly T[],
): T[] {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));
  const resolved: T[] = [];
  for (const id of ids) {
    const channel = byId.get(id);
    if (channel) resolved.push(channel);
  }
  return resolved;
}
