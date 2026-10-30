"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { accountToken } from "@/hooks/use-account";
import type {
  ReactionKind,
  Review,
  ReviewsPayload,
} from "@/components/reviews/types";

/**
 * The reviews, as the browser knows them.
 *
 * The browser never decides anything here. It holds the last thing the
 * server said, and the only moment it holds anything else is the
 * half-second between a visitor pressing a reaction and the answer
 * coming back — and even then it holds a *copy* that is thrown away the
 * moment the server answers, replaced by whatever the server said.
 *
 * That is the same shape as the watch clock: the browser reports, the
 * server decides, the interface follows the answer. A patched console
 * grants nothing because there is nothing here to patch — a counter that
 * only exists in the browser is not a counter.
 *
 * The store is one module-level list for the whole page, the way the
 * favourites and the account are: one request, many readers.
 */

/** The state the interface works with. */
export type ReviewsState = {
  /** True once the server has answered. Until then nothing is claimed. */
  loaded: boolean;
  /**
   * True when the desk can be read at all. False is a statement about
   * us, not about the reviews: it means nobody can see anything, so the
   * section says that instead of saying there is nothing.
   */
  configured: boolean;
  /** Why the desk cannot be read, in a sentence a person can read. */
  reason: string | null;
  reviews: Review[];
  /**
   * The reviews with a reaction in the air — the ones showing an
   * optimistic copy. The interface marks them `aria-busy`, so the
   * visitor is told the number is on its way rather than being left to
   * assume it is settled.
   */
  busy: string[];
};

const EMPTY: ReviewsState = {
  loaded: false,
  configured: true,
  reason: null,
  reviews: [],
  busy: [],
};

/**
 * How the server has answered, so far.
 *
 * `server` is the last answer; `reading` is what the components are
 * handed. They are two variables because `reading` has to keep the same
 * identity between two changes, and building a fresh object on every
 * read would hand React a new one every render — which `useSyncExternal
 * Store` reads as "the store changed", forever.
 */
let server: ReviewsState = EMPTY;
let reading: ReviewsState = EMPTY;

/**
 * The optimistic copies, by review id.
 *
 * Kept apart from the server's answer on purpose: dropping one on a
 * failure restores the server's number exactly, and nothing else has to
 * be unwound. One review, one optimistic copy, no history.
 */
let patches = new Map<string, Review>();

const listeners = new Set<() => void>();

/** A review, with the optimistic copy in place of the server's, if any. */
function patched(review: Review): Review {
  return patches.get(review.id) ?? review;
}

/** Rebuild what the components read. Called once per real change. */
function restate(): void {
  reading = {
    ...server,
    reviews: server.reviews.map(patched),
    busy: [...patches.keys()],
  };
}

function emit(): void {
  restate();
  for (const listener of listeners) listener();
}

function publish(next: ReviewsState): void {
  server = next;
  emit();
}

/** The list as it is shown: the server's answer, patched where a
 *  request is still in the air. */
function shown(): Review[] {
  return server.reviews.map(patched);
}

/**
 * Apply a reaction to a copy of one review.
 *
 * The arithmetic is the same arithmetic the server does: the old reaction
 * comes off, the new one goes on, and clearing takes it off and leaves
 * nothing behind. It is a copy — the server's row is untouched.
 */
function applyReaction(
  review: Review,
  next: ReactionKind | null,
): Review {
  const counts = { ...review.counts };
  const previous = review.own;

  if (previous && previous !== next) {
    counts[previous] = Math.max(0, counts[previous] - 1);
  }
  if (next) counts[next] = counts[next] + 1;

  return { ...review, counts, own: next };
}

/** Read the list again, with the session the browser holds. */
async function load(channelId?: string | null): Promise<void> {
  const token = await accountToken();

  try {
    const search = new URLSearchParams();
    if (channelId) search.set("channel", channelId);
    search.set("limit", "6");

    const response = await fetch(`/api/reviews?${search.toString()}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });

    const payload = (await response.json()) as ReviewsPayload;
    patches = new Map();
    publish({
      loaded: true,
      configured: Boolean(payload.configured),
      reason: payload.reason ?? null,
      reviews: Array.isArray(payload.reviews) ? payload.reviews : [],
      busy: [],
    });
  } catch {
    // The list is a nicety, not a promise: the old one stays and the
    // next read tries again.
    publish({ ...server, loaded: true });
  }
}

/** What a write answers with. */
type WriteAnswer = {
  ok: true;
  review: Review;
} | {
  ok: false;
  error: string;
  needsSession: boolean;
};

/** The shape a write answers with on the wire, whichever half it is. */
type WriteWire = {
  review?: Review;
  error?: string;
  needsSession?: boolean;
};

/** Put the token on a request, when there is a session. */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await accountToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/**
 * React to a review: optimistically, then whatever the server says.
 *
 * The optimistic copy is shown at once — a visitor who pressed a button
 * expects to see it move — and the answer replaces it. On a failure the
 * copy is dropped and the server's numbers return, so the row is never
 * left claiming something the database does not.
 */
async function react(
  reviewId: string,
  kind: ReactionKind | null,
): Promise<WriteAnswer> {
  const current = shown().find((review) => review.id === reviewId);
  if (!current) {
    return { ok: false, error: "Recenzia nu mai este pe pagină.", needsSession: false };
  }

  patches.set(reviewId, applyReaction(current, kind));
  emit();

  try {
    const response = await fetch("/api/reviews/react", {
      method: "POST",
      headers: {
        ...(await authHeaders()),
        "content-type": "application/json",
      },
      body: JSON.stringify({ reviewId, kind }),
      cache: "no-store",
    });

    const payload = (await response.json()) as WriteWire;

    if (!response.ok || !payload.review) {
      patches.delete(reviewId);
      emit();
      return {
        ok: false,
        error: payload.error ?? "Reacția nu a putut fi salvată.",
        needsSession: Boolean(payload.needsSession),
      };
    }

    // Reconcile: the server's answer replaces the optimistic copy, and
    // the review's place in the order is the server's to decide.
    const settled = payload.review;
    patches.delete(reviewId);
    publish({
      ...server,
      reviews: server.reviews.map((review) =>
        review.id === settled.id ? settled : review,
      ),
      busy: [...patches.keys()],
    });

    return { ok: true, review: settled };
  } catch {
    patches.delete(reviewId);
    emit();
    return {
      ok: false,
      error: "Nu am putut contacta serverul. Încearcă din nou.",
      needsSession: false,
    };
  }
}

/** Write a review, then re-read the list so the server's order stands. */
async function submit(draft: {
  rating: number;
  body: string;
  channelId: string;
  programmeTitle: string | null;
  programmeStartsAt: string | null;
  programmeEndsAt: string | null;
}): Promise<WriteAnswer> {
  try {
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        ...(await authHeaders()),
        "content-type": "application/json",
      },
      body: JSON.stringify(draft),
      cache: "no-store",
    });

    const payload = (await response.json()) as WriteWire;

    if (!response.ok || !payload.review) {
      return {
        ok: false,
        error: payload.error ?? "Recenzia nu a putut fi salvată.",
        needsSession: Boolean(payload.needsSession),
      };
    }

    // A new review changes the ranking, and the ranking is the server's:
    // the list is read again rather than patched.
    await load();

    const settled = payload.review;
    return { ok: true, review: settled };
  } catch {
    return {
      ok: false,
      error: "Nu am putut contacta serverul. Încearcă din nou.",
      needsSession: false,
    };
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The state the component reads.
 *
 * The same object every time, until something really changes: React
 * compares it with `Object.is`, and a fresh object here would be a new
 * answer on every render.
 */
function getSnapshot(): ReviewsState {
  return reading;
}

function getServerSnapshot(): ReviewsState {
  return EMPTY;
}

export function useReviews(channelId?: string | null) {
  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const reload = useCallback(() => load(channelId), [channelId]);

  // The first read happens once the component is on screen, which is
  // what keeps the section static in the HTML and lets the list arrive
  // without the section moving under it.
  const start = useCallback(() => {
    void load(channelId);
  }, [channelId]);

  return useMemo(
    () => ({
      ...state,
      reload,
      start,
      react: (reviewId: string, kind: ReactionKind | null) =>
        react(reviewId, kind),
      submit,
    }),
    [state, reload, start],
  );
}
