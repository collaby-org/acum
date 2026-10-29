"use client";

import type { EpgGuide } from "@/components/now-next";
import type { Quality } from "@/data/types";
import type { ChannelLike } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/utils";
import { useFocusLoop } from "@/hooks/use-focus-loop";
import { TVChannelCard } from "./card";
import { TV_RAIL_CLASS, TV_RAIL_PROPS } from "./focusable";

/**
 * A row of channels, in the shape a television wants one.
 *
 * A rail is a **navigation scope that wraps**: left and right meet at the
 * far end of the row, so a strip of six channels is a ring rather than a
 * corridor with two walls. That is `data-tv-loop="x"`, and it is why the
 * engine can take an arrow key all the way around without a special case.
 *
 * Three other things make it a rail and not a flexbox:
 *
 * - **It remembers where you were.** `useFocusLoop` restores the user's
 *   position when the cards re-render out from under them, because a rail
 *   that loses the user loses the D-pad with them.
 * - **It hides its scrollbar.** A scrollbar is furniture for a mouse, and
 *   there is no mouse.
 * - **It never grows focus itself.** Focus belongs to the cards, and the
 *   cards are real buttons; the rail only decides what is in reach.
 */

export type TVChannelRowProps<T extends ChannelLike> = {
  /** The row's name. A row without one is a wall of pictures. */
  title: string;
  /** A line beside the name — a count, a place, a time. */
  caption?: string;
  channels: readonly T[];
  onPlay: (channel: T) => void;
  /** The day's guide, so each card can name what is on now. */
  guide?: EpgGuide | null;
  /** Per-channel quality, when the caller knows it better than the catalogue does. */
  qualityFor?: (channel: T) => Quality | null | undefined;
  /** Per-channel live audience, measured at the proxy. */
  viewsFor?: (channel: T) => number | null | undefined;
  /** Per-channel popularity, the source's cumulative ranking. */
  popularityFor?: (channel: T) => number | null | undefined;
  className?: string;
};

export function TVChannelRow<T extends ChannelLike>({
  title,
  caption,
  channels,
  onPlay,
  guide,
  qualityFor,
  viewsFor,
  popularityFor,
  className,
}: TVChannelRowProps<T>) {
  const rail = useFocusLoop<HTMLDivElement>();

  if (channels.length === 0) return null;

  return (
    <section className={cn("animate-tv-row-in", className)}>
      <div className="flex items-baseline gap-3 tv-safe-area">
        <h2 className="font-display text-tv-lead font-semibold tracking-[-0.02em] text-ink">
          {title}
        </h2>
        <span className="text-tv-caption text-ink-faint">
          {caption ?? plural(channels.length, "1 canal", "canale", "canale")}
        </span>
      </div>

      <div
        ref={rail}
        {...TV_RAIL_PROPS}
        className={cn(
          TV_RAIL_CLASS,
          // The gutter is padding, not margin, so a card scrolled to the
          // far end of the row still lands in the middle of it.
          "flex gap-5 px-[var(--tv-gutter)] py-6",
          className,
        )}
      >
        {channels.map((channel) => (
          <TVChannelCard
            key={channel.id}
            channel={channel}
            onPlay={onPlay}
            guide={guide}
            quality={qualityFor?.(channel)}
            // The screen counts a crowd, so `undefined` is the way to say
            // "not counted here" — a null would read as a count of zero.
            views={viewsFor?.(channel) ?? undefined}
            popularity={popularityFor?.(channel)}
          />
        ))}
      </div>
    </section>
  );
}
