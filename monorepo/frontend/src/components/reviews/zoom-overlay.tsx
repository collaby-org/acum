"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * The choreography of a small panel.
 *
 * What this is, in one paragraph: a panel that **scales and fades in**
 * from the point it was asked for, and on the way out **goes into the
 * point that dismissed it** — the click, or the press, for mouse, touch
 * and remote alike. Travel towards a point reads as "the panel came from
 * that button and goes back into it"; an in-place fade reads as a
 * popover being hidden.
 *
 * The mechanism is the Web Animations API, not a CSS class. It has to
 * be: where the panel came from is a coordinate, and it is a different
 * coordinate every time the panel is opened. A keyframe animation cannot
 * carry a per-open origin; `element.animate()` can, because the keyframes
 * are built at animation time with the origin measured in them.
 *
 * Three rules this file keeps:
 *
 *   1. **Compositor only.** The animation touches `transform` and
 *      `opacity` and nothing else. No width, no top, no reflow — so
 *      nothing under the visitor's hands shifts while it runs, which is
 *      the whole point.
 *
 *   2. **The global reduced-motion rule does not apply here.** The
 *      stylesheet kills CSS animations under `prefers-reduced-motion`;
 *      `element.animate()` is not a CSS animation, so it is not killed
 *      by it. The preference is read here, explicitly, and the
 *      choreography then does not run at all: the panel is simply there,
 *      and it is simply gone. Nothing travels, nothing fades, and nothing
 *      waits for an animation to finish.
 *
 *   3. **The exit is awaited.** The parent is free to flip `open` to
 *      false in the same tick it decides to close; the panel stays
 *      mounted until the animation it is running has finished, and only
 *      then does it unmount itself.
 *
 * Two more rules the file keeps, because a panel that breaks them is a
 * panel nobody can use:
 *
 *   4. **The surface is usable while it moves.** The focus goes into the
 *      panel before the arrival animation has finished, and the panel is
 *      never inert while it is on its way out. The animation is a layer
 *      over a working surface, not a gate in front of it.
 *
 *   5. **The animation never holds the focus.** When the panel leaves,
 *      the focus goes back to where it came from in the same moment the
 *      exit starts, and Tab is not trapped while the panel is on its way
 *      out. A visitor who closes the panel is not held inside it for the
 *      length of an animation.
 */

/** A point on the screen, in viewport coordinates. */
export type ZoomPoint = { x: number; y: number };

/** The choreography, in milliseconds. */
const ENTER_MS = 220;
const EXIT_MS = 180;

/** Where the panel starts from, and where it goes back to. */
const ZOOMED = 0.86;

/** The app's own spring curve. It overshoots, which is what makes a panel
 *  feel as though it has weight rather than sliding. */
const EASE_SPRING = "cubic-bezier(0.22, 1.14, 0.36, 1)";
const EASE_OUT = "cubic-bezier(0.4, 0, 0.2, 1)";

/** The width below which the panel is a sheet rather than a popover. */
const SHEET_QUERY = "(max-width: 639px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** The things inside a panel that Tab can reach. */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Read a media query once, and again when it changes. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** The centre of an element, in viewport coordinates. */
function centreOf(element: HTMLElement): ZoomPoint {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * How far the panel has to travel to reach a point.
 *
 * Measured against the panel's own centre, so one function gives both
 * the way in and the way out: the panel arrives at its place having
 * travelled from the point, and leaves for it.
 */
function travelTo(panel: HTMLElement, point: ZoomPoint): ZoomPoint {
  const centre = centreOf(panel);
  return { x: point.x - centre.x, y: point.y - centre.y };
}

/** One run of the choreography. */
function choreograph(
  panel: HTMLElement,
  keyframes: Keyframe[],
  duration: number,
  easing: string,
): Animation {
  return panel.animate(keyframes, { duration, easing, fill: "both" });
}

/**
 * The keyframes for arriving.
 *
 * On a phone the panel is a sheet and the movement is upwards: a sheet
 * that zoomed out of a corner would be a corner of the screen the press
 * was never near. The scaling and the fading are the same in both — only
 * the direction of the travel changes.
 *
 * The travel is written into the keyframes as numbers rather than passed
 * through a CSS variable. `element.animate()` has to interpolate between
 * two transforms, and a `var()` inside one is something engines have
 * never agreed on; a pair of numbers is something every one of them
 * interpolates.
 *
 * There is no reduced version of these frames: when the visitor asks for
 * less movement, there are no frames at all.
 */
function enteringFrames(travel: ZoomPoint, sheet: boolean): Keyframe[] {
  if (sheet) {
    return [
      { opacity: 0, transform: "translate3d(0, 26px, 0) scale(0.99)" },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    ];
  }
  return [
    {
      opacity: 0,
      transform: `translate3d(${travel.x}px, ${travel.y}px, 0) scale(${ZOOMED})`,
    },
    { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
  ];
}

/**
 * The keyframes for leaving.
 *
 * Both layouts leave the same way: into the point that dismissed the
 * panel. On a phone the sheet shrinks towards it, which reads as the
 * sheet being taken back rather than dropped into the sea.
 */
function leavingFrames(travel: ZoomPoint): Keyframe[] {
  return [
    { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    {
      opacity: 0,
      transform: `translate3d(${travel.x}px, ${travel.y}px, 0) scale(${ZOOMED})`,
    },
  ];
}

/**
 * Keep the page from scrolling behind the panel, without moving it.
 *
 * Hiding the overflow takes the scrollbar off a desktop browser, and the
 * page would jump sideways by exactly that width. The scrollbar is
 * measured and given back as padding on the body, so the page does not
 * move — and on a browser with overlay scrollbars (every phone, and the
 * installed PWA) the width is zero and nothing is added at all.
 */
let scrollLocked = 0;
const scrollRestore = { overflow: "", paddingRight: "" };

function lockScroll(): void {
  if (typeof document === "undefined") return;
  scrollLocked += 1;
  if (scrollLocked > 1) return;

  const body = document.body;
  const bar = window.innerWidth - document.documentElement.clientWidth;

  scrollRestore.overflow = body.style.overflow;
  scrollRestore.paddingRight = body.style.paddingRight;
  body.style.overflow = "hidden";
  if (bar > 0) body.style.paddingRight = `${bar}px`;
}

function unlockScroll(): void {
  if (typeof document === "undefined") return;
  scrollLocked = Math.max(0, scrollLocked - 1);
  if (scrollLocked > 0) return;

  const body = document.body;
  body.style.overflow = scrollRestore.overflow;
  body.style.paddingRight = scrollRestore.paddingRight;
}

/** Move the focus inside, so a keyboard is not left behind. */
function focusFirst(panel: HTMLElement): void {
  const target = panel.querySelector<HTMLElement>(FOCUSABLE);
  if (target) {
    target.focus({ preventScroll: true });
    return;
  }
  if (panel.getAttribute("tabindex") !== "-1") panel.setAttribute("tabindex", "-1");
  panel.focus({ preventScroll: true });
}

/**
 * How much of the screen the software keyboard is eating.
 *
 * On a phone the keyboard covers the bottom of the page, and a sheet that
 * ends up under it is a sheet nobody can read or answer in. The visual
 * viewport says how much of the layout viewport is still visible; the gap
 * between the two is the keyboard, and the panel is lifted by exactly
 * that much.
 *
 * Both events are watched: the keyboard changes the size of the viewport
 * when it opens, and it scrolls the viewport when it opens half way up
 * the screen — the two together are the whole of what happens on a phone.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const measure = () => {
      const visible = viewport.offsetTop + viewport.height;
      const gap = Math.round(window.innerHeight - visible);
      setInset(gap > 0 ? gap : 0);
    };

    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);

    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, []);

  return inset;
}

export type ZoomOverlayProps = {
  /** True while the panel is wanted on screen. */
  open: boolean;
  /**
   * The point the panel was asked for. The way out uses it when the
   * dismissal carried no point of its own.
   */
  origin?: ZoomPoint | null;
  /** Called once the panel has finished leaving. */
  onExited?: () => void;
  /**
   * Called when the visitor asks to close: Escape, the page behind, or
   * the panel's own dismiss button. The panel leaves first and unmounts
   * itself afterwards; `open` is expected to already be false.
   */
  onClose: () => void;
  /** What the panel says it is, for a screen reader. */
  label: string;
  /** The panel's own classes. */
  className?: string;
  /** A panel in the middle everywhere, or a sheet at the bottom. */
  variant?: "panel" | "sheet";
  children: ReactNode;
};

export function ZoomOverlay({
  open,
  origin = null,
  onExited,
  onClose,
  label,
  className,
  variant = "panel",
  children,
}: ZoomOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  /** The animation currently running, so it can be cancelled. */
  const running = useRef<Animation | null>(null);
  /**
   * The point the panel came from, read once when it opens.
   *
   * A ref, and not the prop, on purpose: the parent hands `origin` over
   * as an object literal, and a new one every render would restart the
   * arrival animation on every repaint of whatever is behind it.
   */
  const from = useRef<ZoomPoint | null>(null);
  /** The last press, wherever it was. The way out looks for it here. */
  const press = useRef<ZoomPoint | null>(null);
  /** Where focus came from, so it can go back. */
  const restore = useRef<HTMLElement | null>(null);

  const narrow = useMediaQuery(SHEET_QUERY);
  const reduced = useMediaQuery(REDUCED_QUERY);
  const sheet = variant === "sheet" || narrow;
  /** How much the software keyboard is covering the bottom of the screen. */
  const keyboardInset = useKeyboardInset();

  /* ---------------- opening ---------------- */

  useLayoutEffect(() => {
    if (!open) return;
    from.current = origin ?? null;
    press.current = null;
    // The panel's own presence and its leaving phase are animation
    // state, not derived state: the panel has to exist for one frame
    // before it can animate, and it has to outlive the close for the
    // same reason. A layout effect is the only place the sequence can be
    // decided without the browser painting an intermediate frame.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- animation phase, set once per open, never in a loop
    setLeaving(false);
     
    setMounted(true);
  }, [open, origin]);

  /**
   * Arrive.
   *
   * A layout effect, and not an effect, because the panel has to be
   * measured and animated before the browser paints it: an ordinary
   * effect would show one frame of the finished panel and then animate
   * it from nowhere, which is a flicker the visitor sees.
   */
  useLayoutEffect(() => {
    if (!mounted || leaving) return;

    const panel = panelRef.current;
    if (!panel) return;

    // Where the focus came from, so it can go back. Remembered once: the
    // element that opened the panel is not the element that happens to be
    // focused when the screen changes shape.
    if (!restore.current) {
      restore.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }

    // Where it came from: the point the visitor asked for, the press that
    // opened it, or failing both, the panel's own centre — which is a
    // zoom out of nothing, and is what a keyboard-open panel gets.
    const point = from.current ?? press.current ?? centreOf(panel);

    running.current?.cancel();
    running.current = null;

    if (reduced) {
      // Less movement asked for: the panel is simply there. No travel, no
      // fade, and nothing to wait for.
      panel.style.opacity = "1";
      panel.style.transform = "none";
    } else {
      running.current = choreograph(
        panel,
        enteringFrames(travelTo(panel, point), sheet),
        ENTER_MS,
        EASE_SPRING,
      );
    }

    // The focus goes in straight away — before the panel has finished
    // arriving — so the surface is usable while it is still moving.
    focusFirst(panel);
  }, [mounted, leaving, sheet, reduced]);

  /* ---------------- closing ---------------- */

  /**
   * The visitor asked to close.
   *
   * The panel is not unmounted here — it leaves first, and unmounts
   * itself when it has arrived.
   */
  useLayoutEffect(() => {
    if (open || !mounted) return;
    // One transition per close, guarded by `open` having flipped: the
    // panel leaves, and the effect cannot run again while it does.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one transition per close, guarded by `open`
    setLeaving(true);
  }, [open, mounted]);

  /**
   * The latest `onExited`, kept in a ref.
   *
   * The exit is read once, when the panel has finished leaving, and the
   * effect is keyed on the leaving phase rather than on the callback's
   * identity: a parent that re-creates the callback mid-animation must
   * not restart the panel's exit.
   */
  const exitedRef = useRef(onExited);
  useEffect(() => {
    exitedRef.current = onExited;
  }, [onExited]);

  useLayoutEffect(() => {
    if (!leaving) return;

    const panel = panelRef.current;
    if (!panel) {
      setMounted(false);
      setLeaving(false);
      exitedRef.current?.();
      return;
    }

    // The point that dismissed it, in order of how well it is known: the
    // press that just happened, the point the panel came from, and
    // failing both the panel's own centre — a zoom into itself.
    const target = press.current ?? from.current ?? centreOf(panel);

    running.current?.cancel();
    running.current = null;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      running.current = null;
      setMounted(false);
      setLeaving(false);
      restore.current?.focus();
      restore.current = null;
      exitedRef.current?.();
    };

    // The focus leaves with the panel, in the same moment the exit
    // starts: an animation must never hold it. Whatever was focused
    // before the panel opened gets it back now, not after the panel is
    // gone.
    restore.current?.focus();
    restore.current = null;

    if (reduced) {
      // Less movement asked for: the panel goes at once, and there is
      // nothing left to wait for.
      finish();
      return;
    }

    const animation = choreograph(
      panel,
      leavingFrames(travelTo(panel, target)),
      EXIT_MS,
      EASE_OUT,
    );
    running.current = animation;

    animation.finished.then(finish, finish);

    // A close that never finished: a hidden tab, a browser that cancelled
    // the animation. The panel must not be left behind.
    const safety = window.setTimeout(finish, EXIT_MS + 250);
    return () => window.clearTimeout(safety);
  }, [leaving, reduced]);

  /* ---------------- the page behind ---------------- */

  useEffect(() => {
    if (!mounted) return;
    lockScroll();
    return unlockScroll;
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  /**
   * Tab stays inside.
   *
   * A panel the visitor can tab out of is a panel they can lose, and
   * losing the focus of a dialog behind the page it covers is the
   * quietest accessibility bug there is.
   *
   * While the panel is leaving, it is not: the focus has already gone
   * back to where it came from, and trapping it now would pull the
   * visitor into a panel that is on its way out.
   */
  const onKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab") return;
      if (leaving) return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((node) => node.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    },
    [leaving],
  );

  /**
   * The page behind dismisses the panel, the way every overlay behaves.
   * The press position of that click is where the panel goes back into.
   *
   * A pointerdown is one event that covers a mouse click, a finger and a
   * remote's centre key alike — which is exactly why the press position
   * is the answer for all three.
   */
  const onBackdropPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      press.current = { x: event.clientX, y: event.clientY };
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={backdropRef}
      data-slot="review-overlay"
      data-state={leaving ? "closed" : "open"}
      onPointerDown={onBackdropPointerDown}
      // The software keyboard covers the bottom of the screen; the gap it
      // leaves is added here, so the panel sits above it instead of
      // under it.
      style={
        keyboardInset > 0 ? { paddingBottom: `${keyboardInset}px` } : undefined
      }
      className={cn(
        "fixed inset-0 z-[60] flex justify-center",
        sheet ? "items-end p-0" : "items-center p-4",
        // A scrim, not a black rectangle: what is behind it is still
        // there, dimmed, so the page does not appear to have changed.
        "bg-black/72 backdrop-blur-[3px]",
      )}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDownCapture={onKeyDownCapture}
        // The panel is never taller than the room the keyboard left it:
        // otherwise the top of it would be cut off by the screen.
        style={
          keyboardInset > 0
            ? { maxHeight: `calc(92dvh - ${keyboardInset}px)` }
            : undefined
        }
        className={cn(
          "relative w-full",
          sheet
            ? // The sheet: safe area first, then the corners.
              "max-w-none rounded-t-[var(--radius-sheet)] border-t border-white/10 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            : "max-w-lg rounded-[var(--radius-panel)] border border-white/10",
          "fx-glass bg-canvas-raised/95 shadow-[var(--shadow-e4)]",
          // The panel never grows past the screen, and it scrolls inside
          // itself rather than pushing the page.
          "max-h-[92dvh] overflow-y-auto overscroll-contain",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
