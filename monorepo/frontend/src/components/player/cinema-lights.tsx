"use client";

/**
 * The lights.
 *
 * Cinema mode dims the page around the picture: the room goes near-black
 * and the frame stays lit, the way a projection booth does it.
 *
 * The dimming is four fixed strips that tile everything the picture is
 * not — one above it, one below it, one to each side. Each strip is
 * measured against the player's own rectangle, so the picture shows
 * through a hole of exactly its shape, and the strips follow it as the
 * page scrolls, as the window resizes and as the picture changes size.
 *
 * Four strips rather than one layer with a window cut out of it, for two
 * reasons. A mask can punch the hole but not the clicks: the strips are
 * real elements, so a press that lands on the dimmed page is a press the
 * page never sees. And the strips are painted in the root stacking
 * context, above the header, the rails and the mobile bar alike — the
 * player itself sits wherever its page put it, at whatever layer that
 * is, so nothing about the player has to move for the lights to come
 * down.
 *
 * A press anywhere in the dark brings them back up. The picture's own
 * controls never leave the hole, so the way back to the light is always
 * the button the visitor pressed to begin with.
 */
import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";

/** The picture's rectangle, and the viewport it sits in. */
type Spot = {
  top: number;
  left: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

/**
 * How long the rectangle keeps being re-read after the lights come down.
 *
 * The player may still be arriving — a dialog easing in, a font landing,
 * a stream reporting its own shape — and a hole cut one frame too early
 * would show a dark seam for a moment.
 */
const SETTLE_FRAMES = 24;

/**
 * The dark itself.
 *
 * Near-black, deeper than the page's own canvas, with the faintest light
 * from above so the room reads as dimmed rather than as a void. The
 * gradient is attached to the viewport rather than to the strip, so the
 * four of them share one continuous field instead of each re-deriving
 * where the light comes from.
 *
 * It is written as a plain style rather than as a Tailwind arbitrary
 * value: the strips are measured in pixels on every scroll, and a value
 * the utility compiler has to parse at build time is one more thing that
 * can quietly fail to apply.
 */
const DARK: CSSProperties = {
  backgroundColor: "#010206",
  backgroundImage:
    "radial-gradient(120% 90% at 50% 0%, rgb(12,13,20), transparent 55%)",
  backgroundAttachment: "fixed",
};

export type CinemaLightsProps = {
  /** The player, whose rectangle stays lit. */
  targetRef: RefObject<HTMLElement | null>;
  /** The lights come back up: a press in the dark. */
  onDismiss: () => void;
};

export function CinemaLights({ targetRef, onDismiss }: CinemaLightsProps) {
  const [spot, setSpot] = useState<Spot | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    let frame = 0;
    let alive = true;

    const measure = () => {
      const box = target.getBoundingClientRect();
      setSpot((prev) => {
        const next: Spot = {
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
        return prev && sameSpot(prev, next) ? prev : next;
      });
    };

    measure();

    let left = SETTLE_FRAMES;
    const settle = () => {
      if (!alive) return;
      measure();
      if (left-- > 0) frame = requestAnimationFrame(settle);
    };
    frame = requestAnimationFrame(settle);

    // Every way the player can move without a resize of its own: the page
    // scrolls under it, the window changes, the picture goes full screen
    // and comes back.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    document.addEventListener("fullscreenchange", measure);
    document.addEventListener("webkitfullscreenchange", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(target);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      document.removeEventListener("fullscreenchange", measure);
      document.removeEventListener("webkitfullscreenchange", measure);
      observer.disconnect();
    };
  }, [targetRef]);

  if (typeof document === "undefined") return null;

  const edge = spot ? edges(spot) : null;

  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[65]">
      {/* The layer the door is cut in: everything the picture is not.

          The strips are opaque the moment they exist. A fade would be
          the kindlier entrance, but a transition needs an animation
          clock to run on, and a tab whose clock is throttled would be
          left looking at a cinema mode that is on and does nothing. The
          dark appearing at once is honest; a dark that may never arrive
          is not.

          The layer itself lets the pointer through so the player behind
          it keeps its own events; each strip takes the pointer back, so
          a press in the dark is a press the strip answers. */}
      {edge ? (
        <>
          {edge.top.height > 0 ? (
            <div
              onClick={onDismiss}
              style={{ ...DARK, top: 0, left: 0, width: "100%", height: edge.top.height }}
              className="fixed pointer-events-auto"
            />
          ) : null}

          {edge.bottom.height > 0 ? (
            <div
              onClick={onDismiss}
              style={{
                ...DARK,
                top: edge.bottom.top,
                left: 0,
                width: "100%",
                bottom: 0,
              }}
              className="fixed pointer-events-auto"
            />
          ) : null}

          {edge.side.width > 0 ? (
            <>
              <div
                onClick={onDismiss}
                style={{
                  ...DARK,
                  top: edge.side.top,
                  bottom: edge.side.bottom,
                  left: 0,
                  width: edge.side.width,
                }}
                className="fixed pointer-events-auto"
              />
              <div
                onClick={onDismiss}
                style={{
                  ...DARK,
                  top: edge.side.top,
                  bottom: edge.side.bottom,
                  right: 0,
                  width: edge.side.width,
                }}
                className="fixed pointer-events-auto"
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>,
    document.body,
  );
}

function sameSpot(a: Spot, b: Spot): boolean {
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height &&
    a.viewportWidth === b.viewportWidth &&
    a.viewportHeight === b.viewportHeight
  );
}

/**
 * The four strips the viewport is cut into, in pixels.
 *
 * The picture's own rectangle is clamped into the viewport first: a
 * player that hangs off the top of the window leaves no room for a strip
 * above it, and a negative height would only make one.
 */
function edges(spot: Spot): {
  top: { height: number };
  bottom: { top: number; height: number };
  side: { top: number; bottom: number; width: number };
} {
  const top = Math.max(0, spot.top);
  const left = Math.max(0, spot.left);
  const bottom = Math.min(spot.viewportHeight, spot.top + spot.height);

  return {
    top: { height: top },
    bottom: { top: bottom, height: Math.max(0, spot.viewportHeight - bottom) },
    side: {
      top,
      bottom: Math.max(0, spot.viewportHeight - bottom),
      width: Math.max(0, left),
    },
  };
}
