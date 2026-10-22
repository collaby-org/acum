"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FocusEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { ChannelCard } from "@/components/channel-card";
import type { EpgGuide } from "@/components/now-next";
import type { Quality } from "@/data/types";
import type { ChannelLike } from "@/lib/navigation";
import { cn, plural } from "@/lib/utils";

type ChannelRailProps<T extends ChannelLike> = {
  title: string;
  eyebrow?: string;
  channels: T[];
  /** The day's guide, so every card can name what is on right now. */
  guide?: EpgGuide | null;
  onPlay: (channel: T) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (
    channel: T,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  /** The picture quality of a channel, when the caller knows it. */
  qualityOf?: (channel: T) => Quality | null | undefined;
  /** How many people are watching a channel right now, when the caller knows. */
  viewsOf?: (channel: T) => number | null | undefined;
  /**
   * The source's cumulative popularity counter, when the caller knows it. It
   * is a ranking, and the card marks it differently from the live count.
   */
  popularityOf?: (channel: T) => number | null | undefined;
  /** Replaces the channel count on the right of the heading. */
  aside?: ReactNode;
  className?: string;
  /** Anchor id, so a deep link or the A→Z index can target this rail. */
  id?: string;
};

function reducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The places a row can rest on: the start of every card.
 *
 * The row has no CSS snap of its own — a snap would pull the row back to
 * the card it started from after every small turn of the wheel, and the
 * wheel would look broken. The row settles on a card by itself, when the
 * gesture ends close enough to one.
 */
function restPoints(
  el: HTMLUListElement,
  selector = "[data-card-index]",
) {
  const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
  return Array.from(el.querySelectorAll<HTMLElement>(selector)).map(
    (item) => item.offsetLeft - el.offsetLeft - pad,
  );
}

/** The place to rest on that is nearest to where the row is now. */
export function nearestRest(
  el: HTMLUListElement,
  target: number,
  selector = "[data-card-index]",
) {
  const points = restPoints(el, selector);
  if (points.length === 0) return { point: target, distance: 0 };
  let point = points[0];
  let distance = Infinity;
  for (const candidate of points) {
    const gap = Math.abs(candidate - target);
    if (gap < distance) {
      distance = gap;
      point = candidate;
    }
  }
  return { point, distance };
}

/**
 * The wheel over a rail moves the rail.
 *
 * A horizontal scroller inside a vertical page: a vertical wheel gesture
 * over the row does nothing by itself, and the browser then scrolls the
 * page under the visitor's finger. The row under the pointer takes the
 * gesture instead, and gives it back only when the row has nothing left
 * to show.
 *
 * The rules:
 *   - a vertical gesture (|deltaY| > |deltaX|) scrolls the row sideways,
 *     a matching distance for a matching turn of the wheel;
 *   - a horizontal gesture is left alone — the browser already scrolls the
 *     row, and the trackpad keeps its momentum;
 *   - the row stops at its edge and hands the rest of the gesture to the
 *     page, so leaving the row is a continuation of the same movement and
 *     never a jump;
 *   - when the gesture ends close to a card, the row settles on it.
 *
 * The listener is not passive: taking the gesture away from the page is
 * the whole point, and that needs `preventDefault`.
 */
export function useRailWheel(
  scroller: React.RefObject<HTMLUListElement | null>,
  selector = "[data-card-index]",
) {
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    let settle: number | undefined;

    const onWheel = (event: WheelEvent) => {
      // Horizontal belongs to the browser: it scrolls the row already.
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      const max = el.scrollWidth - el.clientWidth;
      // The row fits on the screen: there is nothing for it to take.
      if (max <= 0) return;

      const room = event.deltaY > 0 ? max - el.scrollLeft : el.scrollLeft;
      // At the edge the row has nothing left to give: the page scrolls.
      if (room <= 0) return;

      const taken = Math.min(Math.abs(event.deltaY), room);
      // The scroll is instant: the row follows the wheel, the way a
      // scrolled row follows a finger.
      el.scrollTo({
        left: el.scrollLeft + Math.sign(event.deltaY) * taken,
        behavior: "instant",
      });

      // What the row could not take belongs to the page, so the row and
      // the page are one continuous gesture.
      const rest = Math.abs(event.deltaY) - taken;
      event.preventDefault();
      if (rest > 0) {
        window.scrollBy({
          top: Math.sign(event.deltaY) * rest,
          behavior: "instant",
        });
      }

      // The gesture is over: if the row is close to a card, it settles on
      // it. Further away than that, it stays where the visitor left it.
      if (settle) window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        settle = undefined;
        const { point, distance } = nearestRest(el, el.scrollLeft, selector);
        if (distance > 28) return;
        el.scrollTo({
          left: point,
          behavior: reducedMotion() ? "instant" : "smooth",
        });
      }, 160);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (settle) window.clearTimeout(settle);
    };
  }, [scroller, selector]);
}

/**
 * A horizontal rail of channel cards.
 *
 * The card under the pointer — or under the keyboard focus — grows, and the
 * others recede. Only one piece of state drives it: the index of the active
 * card.
 *
 * The scroller is the delicate part. A horizontal scroller clips what
 * overflows it, so the rail keeps the room the grown card needs *inside* the
 * scrollport: vertical padding above and below the row, and a gutter on
 * every card. Nothing is cut, and the grown card never slides under the
 * section above it.
 */
export function ChannelRail<T extends ChannelLike>({
  title,
  eyebrow,
  channels,
  guide,
  onPlay,
  isFavorite,
  onToggleFavorite,
  qualityOf,
  viewsOf,
  popularityOf,
  aside,
  className,
  id,
}: ChannelRailProps<T>) {
  const scroller = useRef<HTMLUListElement>(null);
  const headingId = useId();
  const [edges, setEdges] = useState({ start: true, end: true, overflow: false });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useRailWheel(scroller);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const start = el.scrollLeft <= 4;
    const end = el.scrollLeft >= max - 4;
    const overflow = max > 4;
    setEdges((prev) =>
      prev.start === start && prev.end === end && prev.overflow === overflow
        ? prev
        : { start, end, overflow },
    );
  }, []);

  useEffect(() => {
    sync();
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync, channels.length]);

  const nudge = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    // The row moves most of a screen and lands on a card.
    const want = el.scrollLeft + direction * Math.round(el.clientWidth * 0.82);
    const { point } = nearestRest(el, want);
    el.scrollTo({
      left: point,
      behavior: reducedMotion() ? "instant" : "smooth",
    });
  };

  /**
   * Bring a card that the pointer only grazes back into the rail.
   *
   * A card that is more than half outside the scrollport is unusable, so
   * the row moves just enough to show it whole — and lands on a card, the
   * way the row rests everywhere else.
   */
  const reveal = (index: number) => {
    const el = scroller.current;
    if (!el) return;
    const item = el.querySelector<HTMLElement>(`[data-card-index="${index}"]`);
    if (!item) return;

    const left = item.offsetLeft - el.offsetLeft;
    const right = left + item.offsetWidth;
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    const visible = Math.min(right, viewRight) - Math.max(left, viewLeft);
    if (visible > item.offsetWidth * 0.5) return;

    let delta = 0;
    if (right > viewRight) delta = right - viewRight + 24;
    else if (left < viewLeft) delta = left - viewLeft - 24;
    if (Math.abs(delta) < 1) return;

    const { point } = nearestRest(el, el.scrollLeft + delta);
    el.scrollTo({
      left: point,
      behavior: reducedMotion() ? "instant" : "smooth",
    });
  };

  const playButtons = useCallback(() => {
    const root = scroller.current;
    if (!root) return [] as HTMLButtonElement[];
    return Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-card-action="play"]'),
    );
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = playButtons();
    if (buttons.length === 0) return;

    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;

    switch (event.key) {
      case "ArrowRight":
        next = current < 0 ? 0 : Math.min(current + 1, buttons.length - 1);
        break;
      case "ArrowLeft":
        next = current < 0 ? buttons.length - 1 : Math.max(current - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = buttons.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const button = buttons[next];
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({
      behavior: reducedMotion() ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  const onFocusWithin = (event: FocusEvent<HTMLUListElement>) => {
    const node = (event.target as HTMLElement).closest("[data-card-index]");
    const position = node?.getAttribute("data-card-index");
    if (position === undefined || position === null) return;
    setActiveIndex(Number(position));
  };

  if (channels.length === 0) return null;

  const mask = !edges.overflow
    ? "none"
    : edges.start && edges.end
      ? "none"
      : edges.start
        ? "linear-gradient(to right, black calc(100% - 2.5rem), transparent 100%)"
        : edges.end
          ? "linear-gradient(to right, transparent 0, black 2.5rem)"
          : "linear-gradient(to right, transparent 0, black 2.5rem, black calc(100% - 2.5rem), transparent 100%)";

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("group/rail relative py-7 sm:py-9", className)}
    >
      <div className="mb-2 flex items-end justify-between gap-4 px-4 sm:px-8 lg:px-12">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
              {eyebrow}
            </p>
          )}
          <h2
            id={headingId}
            className="font-display text-xl font-semibold tracking-tight sm:text-[26px]"
          >
            {title}
          </h2>
        </div>

        {aside ?? (
          <p className="shrink-0 text-xs tabular-nums text-ink-faint">
            {channels.length}{" "}
            {plural(channels.length, "canal", "canale", "de canale")}
          </p>
        )}
      </div>

      <div className="relative">
        <ul
          ref={scroller}
          role="list"
          aria-label={title}
          onScroll={sync}
          onKeyDown={onKeyDown}
          onFocus={onFocusWithin}
          onPointerLeave={() => setActiveIndex(null)}
          style={{ maskImage: mask, WebkitMaskImage: mask }}
          // No CSS snap: a snap would pull the row back to the card it
          // started from after every small turn of the wheel, and the
          // wheel would look broken. The row settles on a card itself.
          className="flex gap-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-4 pb-5 pt-6 scroll-pl-4 fx-hide-scrollbar sm:px-8 sm:scroll-pl-8 lg:px-12 lg:scroll-pl-12 [overflow-anchor:none] [contain:paint]"
        >
          {channels.map((channel, index) => (
            <li
              key={channel.id}
              data-card-index={index}
              onPointerEnter={() => {
                setActiveIndex(index);
                reveal(index);
              }}
              className={cn(
                "relative shrink-0 px-1.5 transition-[opacity,scale] duration-[var(--dur-base,300ms)]",
                // The card under the pointer is the lit one; the rest of
                // the row steps back so it reads as one focus.
                activeIndex !== null && activeIndex !== index && "opacity-60 scale-[0.985]",
                activeIndex === index && "z-10",
                "motion-reduce:transition-none motion-reduce:scale-100!",
              )}
            >
              <ChannelCard
                channel={channel}
                onPlay={onPlay}
                isFavorite={isFavorite(channel.id)}
                onToggleFavorite={onToggleFavorite}
                quality={qualityOf?.(channel)}
                views={viewsOf?.(channel)}
                popularity={popularityOf?.(channel)}
                guide={guide}
                index={index}
              />
            </li>
          ))}
        </ul>

        {edges.overflow && !edges.start && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Derulează la stânga"
            className="absolute left-1 top-1/2 z-30 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-canvas/85 text-ink backdrop-blur-md fx-edge fx-press transition-[background-color,transform] duration-200 hover:bg-canvas hover:text-signal-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal motion-reduce:transition-none"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
        )}

        {edges.overflow && !edges.end && (
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Derulează la dreapta"
            className="absolute right-1 top-1/2 z-30 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-canvas/85 text-ink backdrop-blur-md fx-edge fx-press transition-[background-color,transform] duration-200 hover:bg-canvas hover:text-signal-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal motion-reduce:transition-none"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        )}
      </div>
    </section>
  );
}
