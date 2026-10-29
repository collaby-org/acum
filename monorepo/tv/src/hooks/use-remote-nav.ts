"use client";

import { useEffect, useRef } from "react";

/**
 * Remote navigation — the D-pad as a first-class input device.
 *
 * A television has no mouse and no keyboard. It has five buttons and they
 * are the only way through the product, so the arrow keys are not a
 * convenience here: they are the interface.
 *
 * ## What this is, and what it deliberately is not
 *
 * Focus is the browser's, not ours. There is no `selectedIndex` kept in
 * React state, no re-render per press, no synthetic `click` on Enter.
 * Every focusable thing on the screen is a real focusable element — a
 * `<button>`, an `<a>` — and this hook only decides *which one* the next
 * arrow key lands on. Everything that follows from real focus comes for
 * free and stays correct: the browser's own `:focus-visible` styling,
 * `scrollIntoView`, the Enter key activating a button, screen readers
 * announcing a link as a link, and a text caret landing in a search
 * field instead of being swallowed by a key handler.
 *
 * ## The DOM contract
 *
 * `[data-tv-nav]`    a navigation scope. The page is one; every rail is
 *                    another, nested inside it. `data-tv-nav="root"` marks
 *                    the outermost one — the one that answers when nothing
 *                    at all is focused yet.
 * `[data-tv-focus]` a focusable thing inside a scope.
 * `data-tv-loop="x"`  the scope wraps horizontally when the row runs out.
 *                    Rails do; the page does not, because a page that
 *                    wraps vertically can never be scrolled off.
 *
 * ## How the next target is chosen
 *
 * Geometry. The candidate must lie in the direction of travel — anything
 * level with or behind the focused element is rejected — and among the
 * survivors the closest straight-ahead one wins, with a penalty for how
 * far off-axis it sits. So from a card, "right" is the card next to it and
 * never the row below; "down" is the card below and never the one three
 * rows down that happens to be closer in x.
 *
 * The scope chain is walked from the innermost outwards, so left/right
 * inside a rail is answered by the rail (which wraps), and up/down falls
 * through it to the page scope when the row has nothing above or below.
 *
 * ## Enter
 *
 * Deliberately absent. The browser activates a focused button on Enter
 * and follows a focused link, so handling it here would only duplicate
 * it — badly, in the one case (a text field) where it must not fire.
 */

export type TvDirection = "up" | "down" | "left" | "right";

/** The keys a remote spells a D-pad with. */
const ARROW_DIRECTIONS: Record<string, TvDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * The keys a remote spells "Back" with.
 *
 * It is spelled differently on every platform: `Escape` is what a browser
 * keyboard sends, `GoBack` is what a Tizen remote sends, `BrowserBack` is
 * Firefox's, `XF86Back` is what a Linux set-top box sends. All of them
 * mean the same thing and all of them are handled here.
 */
const BACK_KEYS = new Set([
  "Escape",
  "GoBack",
  "BrowserBack",
  "XF86Back",
  "Back",
]);

/** How far off the axis of travel a candidate may sit, weighted. */
const CROSS_AXIS_PENALTY = 2.5;

/** Two pixels of slack, so a card is not rejected for rounding. */
const EPSILON = 2;

/** The elements a keypress never steals from. */
const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export type RemoteNavigationOptions = {
  /** The Back key. Omit it and Back stays the browser's. */
  onBack?: () => void;
  /** Turn the whole thing off — for a surface that wants native arrows. */
  enabled?: boolean;
};

/**
 * Attach the remote. Mount it once, at the root of the app.
 *
 * `onBack` is read through a ref so a new callback identity does not
 * detach and reattach the listener on every render.
 */
export function useRemoteNavigation({
  onBack,
  enabled = true,
}: RemoteNavigationOptions = {}) {
  const backRef = useLatest(onBack);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      // Back: the app answers it, and the browser's own history step is
      // stopped so the two do not both happen.
      if (BACK_KEYS.has(event.key)) {
        const back = backRef.current;
        if (!back) return;
        event.preventDefault();
        back();
        return;
      }

      // Never take a key while the user is typing into one of them.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || TYPING_TAGS.has(target.tagName))
      ) {
        return;
      }

      const direction = ARROW_DIRECTIONS[event.key];
      if (!direction) return;

      if (moveFocus(direction)) {
        // The engine moved focus, so the page must not scroll as well.
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, backRef]);
}

/* ------------------------------------------------------------------ *
 * The engine
 * ------------------------------------------------------------------ */

/**
 * Move focus one step in a direction.
 *
 * Returns whether it moved, which is what tells the caller to stop the
 * browser from scrolling the page underneath.
 */
function moveFocus(direction: TvDirection): boolean {
  const active = document.activeElement;
  const focused =
    active instanceof HTMLElement && active !== document.body ? active : null;
  const from = focused ? focused.getBoundingClientRect() : null;

  // The scopes that can answer, innermost first. A rail is asked before
  // the page, and the page inherits whatever the rail cannot do.
  for (const scope of scopeChain(focused)) {
    const next = nextFocusable(scope, from, direction);
    if (next) {
      focus(next);
      return true;
    }
  }

  // Nothing anywhere in that direction. When focus came from the body —
  // the first press after a page loads — the root scope is the whole
  // answer, and it answers with its first focusable.
  if (!focused) {
    const root = document.querySelector<HTMLElement>('[data-tv-nav="root"]');
    const first = root ? focusables(root)[0] : null;
    if (first) {
      focus(first);
      return true;
    }
  }

  return false;
}

/** Give an element focus and bring it where the user can see it. */
function focus(el: HTMLElement): void {
  el.focus({ preventScroll: true });
  // `nearest` on the cross axis so a rail scrolls horizontally without
  // ever shoving the page vertically; `center` on the axis of travel so
  // the item the user asked for lands in the middle of its row, the way
  // it does on a real television. The smooth behaviour is the document's
  // `scroll-behavior`, which the reduced-motion rule collapses, and the
  // fixed nav bar is cleared by `scroll-margin` in the stylesheet.
  el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

/**
 * The scopes a keypress is answered by, innermost first.
 *
 * The active element's own scope comes first; if that scope has nothing
 * in the direction, its parent's does, and so on up to the root.
 *
 * The root is also appended when it is *not* an ancestor, which happens
 * once per page: the navigation bar. It is `position: fixed`, so it can
 * never be a child of the scrolling content, and without this a press of
 * "down" from a nav item would find no scope at all and go nowhere. With
 * it, the bar hands the key to the page and the page answers.
 */
function scopeChain(focused: HTMLElement | null): HTMLElement[] {
  const chain: HTMLElement[] = [];
  const root = document.querySelector<HTMLElement>('[data-tv-nav="root"]');

  let node: Element | null = focused;
  while (node) {
    if (node instanceof HTMLElement && "tvNav" in node.dataset) {
      chain.push(node);
      if (node === root) break;
    }
    node = node.parentElement;
  }

  if (root && !chain.includes(root)) chain.push(root);
  return chain;
}

/** The focusable things inside a scope, in document order. */
function focusables(scope: HTMLElement): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>("[data-tv-focus]")].filter(
    isReachable,
  );
}

/** Whether the user can actually land on it. */
function isReachable(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  if (el.tabIndex < 0) return false;
  // Nothing laid out is nothing to land on: a hidden rail, a card whose
  // list shrank. `getClientRects` is the one check that catches both a
  // `display: none` subtree and a zero-height collapse.
  return el.getClientRects().length > 0;
}

/**
 * The best next target in a direction, or `null`.
 *
 * A scope that wraps (`data-tv-loop="x"`) answers a dead end with the
 * far end of the row, so a rail of four channels is a circle rather than
 * a corridor with two walls.
 */
function nextFocusable(
  scope: HTMLElement,
  from: DOMRect | null,
  direction: TvDirection,
): HTMLElement | null {
  const candidates = focusables(scope);

  // Nothing was focused, so there is no "from" to measure from: the first
  // thing in the scope is the answer.
  if (!from) return candidates[0] ?? null;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    const weight = score(candidate.getBoundingClientRect(), from, direction);
    if (weight !== null && weight < bestScore) {
      best = candidate;
      bestScore = weight;
    }
  }

  if (best) return best;

  // The dead end, answered only on the axis the scope wraps.
  //
  // `"x"` wraps the horizontal axis and nothing else: a rail is a strip
  // that meets its own ends, and a vertical key must *fall out of it* to
  // the scope above, or the row would trap the user inside itself — a
  // "down" from any card would land back on the row's first card and the
  // page below would be unreachable. `"xy"` is for a scope that is a
  // closed surface in both axes. The root scope sets neither, because a
  // page you cannot scroll off is a page you cannot leave.
  const loop = scope.dataset.tvLoop;
  const horizontal = direction === "left" || direction === "right";
  const wraps = horizontal ? loop === "x" || loop === "xy" : loop === "xy";

  if (wraps && candidates.length > 0) {
    return direction === "left" || direction === "up"
      ? candidates[candidates.length - 1]
      : candidates[0];
  }

  return null;
}

/**
 * How far a candidate is from the focused element, in a direction.
 *
 * `null` when the candidate is not in that direction at all. Lower is
 * better; the winner is the closest thing straight ahead.
 */
function score(
  to: DOMRect,
  from: DOMRect,
  direction: TvDirection,
): number | null {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  const horizontal = direction === "left" || direction === "right";
  const forward = horizontal
    ? direction === "right"
      ? dx
      : -dx
    : direction === "down"
      ? dy
      : -dy;

  // Behind, or level. Not a candidate in this direction.
  if (forward < EPSILON) return null;

  const cross = horizontal ? dy : dx;
  return forward + Math.abs(cross) * CROSS_AXIS_PENALTY;
}

/* ------------------------------------------------------------------ *
 * A ref that is always current
 * ------------------------------------------------------------------ */

/**
 * A ref whose `.current` is always the latest value given to it.
 *
 * This is the standard shape for "a callback that must not re-attach a
 * listener". It is written in an effect rather than during render on
 * purpose: React forbids writing a ref mid-render, and a listener that
 * survives a re-render has to be told about the new callback after the
 * commit that produced it. An effect with no dependency array runs after
 * every render, which is exactly the contract — and it is the only place
 * the keydown handler ever reads the value from.
 */
function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
