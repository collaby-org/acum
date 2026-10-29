"use client";

import { useEffect } from "react";

/**
 * The cursor rule.
 *
 * A cursor is the web answering to a mouse. A television has no mouse, so
 * on a television a cursor is a defect: a white arrow drifting over a
 * dark panel, pointing at nothing, readable as a fault in the screen.
 *
 * The rule is one sentence, and it is the only thing this hook exists to
 * enforce:
 *
 *   **The cursor is absent until a pointer actually moves.**
 *
 * So it starts absent — the initial HTML carries
 * `data-tv-cursor="remote"`, so there is no frame in which a television
 * ever sees an arrow — and the first genuine mouse movement flips it to
 * `mouse`, where the cursor's own natural styles come back. The next
 * press of a D-pad takes it away again. Neither state is permanent and
 * neither is guessed: both are earned by what the user just did, which
 * is why the same build is correct on a TV and correct on a laptop
 * without asking which one it is running on.
 *
 * ## Why an attribute and not a class
 *
 * The stylesheet is the thing that hides the cursor, and it hangs off
 * `html[data-tv-cursor="remote"]`. One attribute on the document element
 * drives a rule the whole tree inherits, so there is nothing to mount,
 * nothing to portal, and nothing for a page transition to lose.
 */

export type CursorInput = "remote" | "mouse";

const ATTRIBUTE = "data-tv-cursor";

/** Write the state to the document, where the stylesheet reads it. */
export function setCursorInput(input: CursorInput): void {
  const root = document.documentElement;
  if (root.getAttribute(ATTRIBUTE) !== input) {
    root.setAttribute(ATTRIBUTE, input);
  }
}

/** The input the document currently believes is driving it. */
export function cursorInput(): CursorInput {
  const value = document.documentElement.getAttribute(ATTRIBUTE);
  return value === "mouse" ? "mouse" : "remote";
}

/**
 * Watch what the user drives with, and keep the document in agreement.
 */
export function useRemoteCursor(): void {
  useEffect(() => {
    let lastX = Number.NaN;
    let lastY = Number.NaN;

    const onPointerMove = (event: PointerEvent) => {
      // A mouse or a pen. Touch and a remote's own pointer events do not
      // count: neither of them has a cursor to show.
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;

      // Movement, not arrival. A television can emit a stray `pointermove`
      // on its own — a window manager nudging a synthetic pointer, a
      // trackpad that has not been touched yet — and a cursor that
      // flickers into existence on a screen with no mouse is worse than
      // one that takes a moment to appear.
      if (event.clientX === lastX && event.clientY === lastY) return;
      lastX = event.clientX;
      lastY = event.clientY;

      setCursorInput("mouse");
    };

    // Every keypress counts as keyboard input — even inside a search
    // field, where a keypress is a statement that a keyboard is in play.
    // A keyboard hides a cursor just as well as a D-pad does.
    const onKeyDown = () => {
      setCursorInput("remote");
    };

    // A touch is not a mouse, and it is not a D-pad either. It is the one
    // input that must not wake the cursor on a device that has both.
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") setCursorInput("remote");
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);
}
