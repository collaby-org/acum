"use client";

import { useEffect, useRef } from "react";

/**
 * Keep a row's focus moving.
 *
 * A rail is a loop: the user goes right, wraps, goes left, wraps. The
 * `use-remote-nav` engine drives that. This hook looks after the other
 * half of the loop — the part that breaks silently.
 *
 * ## The bug it exists to prevent
 *
 * A rail's contents are not static. The channel list arrives after the
 * first paint, a live status turns over, a row is empty and collapses,
 * a search narrows what is left. Any one of those re-renders the cards,
 * and a card that re-renders out from under a focused element takes the
 * focus with it: it unmounts, the browser drops focus to `<body>`, and
 * the arrow keys stop doing anything at all. On a television that is the
 * worst failure there is — a remote with a dead D-pad looks exactly like
 * a broken app, and there is no mouse to click out of it.
 *
 * So the row remembers where the user was, by *position*, and puts them
 * back there when the cards change. Position rather than channel, on
 * purpose: the user said "I am looking at the fourth thing here", and
 * after a re-render the fourth thing here is what they should still be
 * looking at. A channel that has gone away is a fact to render, not a
 * fact to punish the user for.
 *
 * ## The bug it must not cause
 *
 * A row that has never held focus must never take it. The observer fires
 * on the very first paint, when React has just inserted the cards and
 * focus is nowhere near this rail — and `restore()` without a guard would
 * happily put focus in a row the user has not touched, in whichever rail
 * happened to mutate last, before they have pressed a single key. So the
 * hook tracks whether this rail was ever engaged and only intervenes
 * once it has been. That single condition is the difference between a
 * row that catches a fall and a row that steals focus.
 *
 * Children only, never attributes: a class change on a card fires the
 * observer continuously on a live row, and the position logic would be
 * running all day for nothing.
 */

/** The same selector the navigation engine reads. */
const FOCUSABLE = "[data-tv-focus]";

export function useFocusLoop<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  /** Where the user is in the row, as a position. */
  const position = useRef(0);
  /** Whether this row has ever held the user's focus. */
  const engaged = useRef(false);

  useEffect(() => {
    const row = ref.current;
    if (!row) return;

    /** The focusable things in this row that are actually laid out. */
    const cards = () =>
      [...row.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.getClientRects().length > 0,
      );

    /** Remember where the focused card sits, whenever there is one. */
    const rememberPointer = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!row.contains(target)) return;
      const index = cards().indexOf(target);
      if (index >= 0) {
        position.current = index;
        engaged.current = true;
      }
    };

    const restore = () => {
      // The guard that makes this a net instead of a hook: a row the user
      // has never been in never takes focus from anywhere else.
      if (!engaged.current) return;

      const list = cards();
      if (list.length === 0) return;

      // The row shrank under the pointer, so the position is clamped
      // rather than reset: a user at the end of a long row who loses the
      // last three cards lands on the last one that is left.
      const next = list[Math.min(position.current, list.length - 1)];
      next.focus({ preventScroll: true });
      next.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
    };

    const observer = new MutationObserver(() => {
      // The row still holds the user: remember where they moved to.
      const active = document.activeElement;
      if (active instanceof HTMLElement && row.contains(active)) return;

      // Not laid out — an emptied row in a collapsed section. Left alone.
      if (row.getClientRects().length === 0) return;

      restore();
    });

    row.addEventListener("focusin", rememberPointer);
    observer.observe(row, { childList: true, subtree: true });

    return () => {
      row.removeEventListener("focusin", rememberPointer);
      observer.disconnect();
    };
  }, []);

  return ref;
}
