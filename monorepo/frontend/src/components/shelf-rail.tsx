"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, X } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { ChannelScreen } from "@/components/channel-card";
import { nearestRest, useRailWheel } from "@/components/channel-rail";
import type { EpgGuide } from "@/components/now-next";
import { STATUS_META } from "@/lib/channel-meta";
import type { ChannelLike } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type ShelfRailProps<T extends ChannelLike = ChannelLike> = {
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
  /** Shows a small remove control on every card. */
  onRemove?: (channel: T) => void;
  /** Shows the reorder controls. `delta` is -1 for earlier, +1 for later. */
  onMove?: (channel: T, delta: -1 | 1) => void;
  className?: string;
  /** Anchor id, so a deep link can target this rail. */
  id?: string;
};

type Direction = -1 | 1;

const CONTROL =
  "grid size-9 place-items-center rounded-full text-ink-muted backdrop-blur-sm fx-edge fx-press " +
  "transition-[color,background-color] duration-[var(--dur-fast,150ms)] " +
  "hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal " +
  "disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none motion-reduce:transform-none!";

function reducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** "1 canal", "7 canale", "24 de canale". */
function channelCount(count: number) {
  if (count === 1) return "1 canal";
  return count >= 20 ? `${count} de canale` : `${count} canale`;
}

/**
 * A rail for one shelf — the pinned shortcuts, the watch-later list.
 *
 * The cards are built here rather than borrowed: the shelf needs a control
 * strip under every poster (reorder, favourite, remove), and the strip has to
 * stay a sibling of the play button, never nested inside it.
 */
export function ShelfRail<T extends ChannelLike>({
  title,
  eyebrow,
  channels,
  guide,
  onPlay,
  isFavorite,
  onToggleFavorite,
  onRemove,
  onMove,
  className,
  id,
}: ShelfRailProps<T>) {
  const headingId = useId();
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true, overflow: false });
  const [announcement, setAnnouncement] = useState("");

  // The wheel over the shelf moves the shelf, and gives the page the
  // gesture only when the shelf has reached its end.
  useRailWheel(scroller, "[data-shelf-id]");

  /** The channel that changed place, so focus can follow it. */
  const pendingFocus = useRef<{ id: string; direction: Direction } | null>(null);

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

  const nudge = (direction: Direction) => {
    const el = scroller.current;
    if (!el) return;
    // The shelf moves most of a screen and lands on a card.
    const want = el.scrollLeft + direction * Math.round(el.clientWidth * 0.82);
    const { point } = nearestRest(el, want, "[data-shelf-id]");
    el.scrollTo({
      left: point,
      behavior: reducedMotion() ? "instant" : "smooth",
    });
  };

  const shift = useCallback(
    (channel: T, delta: Direction) => {
      if (!onMove) return;
      const index = channels.findIndex((entry) => entry.id === channel.id);
      const target = index + delta;
      if (index === -1 || target < 0 || target >= channels.length) return;
      pendingFocus.current = { id: channel.id, direction: delta };
      setAnnouncement(
        `${channel.name} a ajuns pe poziția ${target + 1} din ${channels.length}.`,
      );
      onMove(channel, delta);
    },
    [channels, onMove],
  );

  // The channel changed place: keep the keyboard where the user left it.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if (!channels.some((channel) => channel.id === pending.id)) return;

    const root = scroller.current;
    const item = root?.querySelector<HTMLElement>(
      `[data-shelf-id="${CSS.escape(pending.id)}"]`,
    );
    if (!item) return;

    const other = pending.direction === -1 ? 1 : -1;
    const preferred = item.querySelector<HTMLButtonElement>(
      `[data-shelf-move="${pending.direction}"]`,
    );
    const fallback = item.querySelector<HTMLButtonElement>(
      `[data-shelf-move="${other}"]`,
    );
    const target =
      preferred && !preferred.disabled
        ? preferred
        : fallback && !fallback.disabled
          ? fallback
          : null;
    target?.focus({ preventScroll: true });
  }, [channels]);

  const playButtons = useCallback(() => {
    const root = scroller.current;
    if (!root) return [] as HTMLButtonElement[];
    return Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-card-action="play"]'),
    );
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    // The reorder controls answer the arrow keys themselves.
    if ((event.target as HTMLElement).closest("[data-shelf-control]")) return;

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

  const onMoveKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    channel: T,
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    shift(channel, event.key === "ArrowLeft" ? -1 : 1);
  };

  // An empty shelf is not a shelf. It shows nothing at all — no heading,
  // no placeholder, no hint. The rail appears the moment the visitor
  // pins or saves something.
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
      className={cn("relative py-7 sm:py-9", className)}
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
          {channelCount(channels.length)}
        </p>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="relative">
        <ul
          ref={scroller}
          role="list"
          aria-label={title}
          onScroll={sync}
          onKeyDown={onKeyDown}
          style={{ maskImage: mask, WebkitMaskImage: mask }}
          // No CSS snap: a snap would pull the shelf back after every
          // small turn of the wheel. It settles on a card by itself.
          className="flex gap-3.5 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-3 pt-1 scroll-pl-4 fx-hide-scrollbar sm:px-8 sm:scroll-pl-8 lg:px-12 lg:scroll-pl-12 [overflow-anchor:none] [contain:paint]"
        >
          {channels.map((channel, index) => {
            const favorite = isFavorite(channel.id);
            const last = index === channels.length - 1;

            return (
              <li
                key={channel.id}
                data-shelf-id={channel.id}
                className="relative w-[248px] shrink-0 sm:w-[272px]"
              >
                <ShelfCard channel={channel} guide={guide} onPlay={onPlay} />

                <div className="mt-2 flex items-center gap-1.5">
                  {onMove && (
                    <>
                      <span
                        aria-hidden
                        className="w-4 text-center font-mono text-[11px] tabular-nums text-ink-faint"
                      >
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        data-shelf-control="move-earlier"
                        data-shelf-move="-1"
                        onClick={() => shift(channel, -1)}
                        onKeyDown={(event) => onMoveKeyDown(event, channel)}
                        disabled={index === 0}
                        aria-label={`Mută ${channel.name} mai la stânga`}
                        className={CONTROL}
                      >
                        <ChevronLeft aria-hidden className="size-4" />
                      </button>
                      <button
                        type="button"
                        data-shelf-control="move-later"
                        data-shelf-move="1"
                        onClick={() => shift(channel, 1)}
                        onKeyDown={(event) => onMoveKeyDown(event, channel)}
                        disabled={last}
                        aria-label={`Mută ${channel.name} mai la dreapta`}
                        className={CONTROL}
                      >
                        <ChevronRight aria-hidden className="size-4" />
                      </button>
                    </>
                  )}

                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      data-shelf-control="favorite"
                      onClick={(event) => onToggleFavorite(channel, event)}
                      aria-pressed={favorite}
                      aria-label={
                        favorite
                          ? `Elimină ${channel.name} din favorite`
                          : `Adaugă ${channel.name} la favorite`
                      }
                      className={cn(CONTROL, favorite && "text-signal")}
                    >
                      <Heart
                        aria-hidden
                        className={cn("size-4", favorite && "fill-current")}
                      />
                    </button>

                    {onRemove && (
                      <button
                        type="button"
                        data-shelf-control="remove"
                        onClick={() => onRemove(channel)}
                        aria-label={`Elimină ${channel.name} din ${title}`}
                        className={cn(CONTROL, "hover:text-live")}
                      >
                        <X aria-hidden className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
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

type ShelfCardProps<T extends ChannelLike> = {
  channel: T;
  guide?: EpgGuide | null;
  onPlay: (channel: T) => void;
};

/**
 * A 16:9 "screen" with the channel's own logo as the broadcast bug, over
 * the still of what is playing right now. The whole screen is one button;
 * the shelf controls live under it, never inside it.
 */
function ShelfCard<T extends ChannelLike>({
  channel,
  guide,
  onPlay,
}: ShelfCardProps<T>) {
  const status = STATUS_META[channel.status];
  const isLive = channel.status === "live";

  return (
    <button
      type="button"
      data-card-action="play"
      onClick={() => onPlay(channel)}
      aria-label={`Vizionează ${channel.name}${isLive ? ", live acum" : `, ${status.label.toLowerCase()}`}`}
      className="group/card block w-full cursor-pointer rounded-[var(--radius-card)] text-left transition-transform duration-[var(--dur-base,300ms)] hover:-translate-y-0.5 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal motion-reduce:transition-none motion-reduce:translate-y-0! motion-reduce:scale-100! [contain:layout_paint]"
      style={{
        transitionTimingFunction:
          "var(--ease-spring, var(--ease-out-expo, cubic-bezier(0.22, 1, 0.36, 1)))",
      }}
    >
      <ChannelScreen channel={channel} guide={guide} />
    </button>
  );
}
