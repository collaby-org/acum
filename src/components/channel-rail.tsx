"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";
import { ChannelCard } from "@/components/channel-card";
import type { ChannelLike } from "@/lib/navigation";
import { cn, plural } from "@/lib/utils";

type ChannelRailProps<T extends ChannelLike> = {
  title: string;
  eyebrow?: string;
  channels: T[];
  onPlay: (channel: T) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (
    channel: T,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  className?: string;
  /** Anchor id, so a deep link or the A→Z index can target this rail. */
  id?: string;
};

function reducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A horizontal rail of channel cards.
 *
 * The card under the pointer — or under the keyboard focus — grows, and the
 * others recede. Only one piece of state drives it: the index of the active
 * card.
 */
export function ChannelRail<T extends ChannelLike>({
  title,
  eyebrow,
  channels,
  onPlay,
  isFavorite,
  onToggleFavorite,
  className,
  id,
}: ChannelRailProps<T>) {
  const scroller = useRef<HTMLUListElement>(null);
  const headingId = useId();
  const [edges, setEdges] = useState({ start: true, end: true, overflow: false });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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
    el.scrollBy({
      left: direction * Math.round(el.clientWidth * 0.82),
      behavior: reducedMotion() ? "auto" : "smooth",
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
      <div className="mb-4 flex items-end justify-between gap-4 px-4 sm:px-8 lg:px-12">
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

        <p className="shrink-0 text-xs tabular-nums text-ink-faint">
          {channels.length}{" "}
          {plural(channels.length, "canal", "canale", "de canale")}
        </p>
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
          className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-3 pt-1 fx-hide-scrollbar sm:px-8 lg:px-12"
        >
          {channels.map((channel, index) => (
            <li
              key={channel.id}
              data-card-index={index}
              onPointerEnter={() => setActiveIndex(index)}
              className={cn(
                "relative shrink-0 snap-start transition-[opacity,scale,translate] duration-[var(--dur-base,300ms)]",
                activeIndex !== null && activeIndex !== index && "opacity-45 scale-[0.97]",
                activeIndex === index && "z-10 -translate-y-1 scale-[1.04]",
                "motion-reduce:transition-none motion-reduce:scale-100! motion-reduce:translate-y-0!",
              )}
            >
              <ChannelCard
                channel={channel}
                onPlay={onPlay}
                isFavorite={isFavorite(channel.id)}
                onToggleFavorite={onToggleFavorite}
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
