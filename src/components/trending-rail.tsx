"use client";

import { useMemo } from "react";
import type { MouseEvent } from "react";
import { ChannelRail } from "@/components/channel-rail";
import type { EpgGuide } from "@/components/now-next";
import type { ChannelLike } from "@/lib/navigation";
import { formatViewers } from "@/lib/utils";

export type TrendingRailProps<T extends ChannelLike = ChannelLike> = {
  channels: T[];
  /** The day's guide, so every card can name what is on right now. */
  guide?: EpgGuide | null;
  /**
   * Our own audience, counted at the proxy. It breaks the tie between two
   * channels the source counts the same way.
   */
  live?: Record<string, number>;
  onPlay: (channel: T) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (
    channel: T,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  className?: string;
  /** Anchor id, so a deep link can target this rail. */
  id?: string;
};

/**
 * The rail that shows what people are watching.
 *
 * The order is the number of people watching, not the programme guide: a
 * visitor opening the page wants to know where the crowd is, and a
 * timetable only tells them what the broadcaster decided to air. Only the
 * channels that are on air right now are in it — a channel nobody watches
 * is not trending, whatever its schedule says.
 */
export function TrendingRail<T extends ChannelLike>({
  channels,
  guide,
  live = {},
  onPlay,
  isFavorite,
  onToggleFavorite,
  className,
  id,
}: TrendingRailProps<T>) {
  const trending = useMemo(() => {
    const count = (channel: T) => live[channel.id] ?? 0;
    const popularity = (channel: T) => channel.views ?? 0;
    // On air means the source is counting viewers for it. The probe status
    // says whether *our* feed works, which is a different question — a
    // channel can be live everywhere and unplayable here.
    const onAir = channels.filter(
      (channel) => channel.status === "live" || popularity(channel) > 0,
    );
    const pool =
      onAir.length > 0
        ? onAir
        : channels.filter((channel) => channel.status !== "none");
    return [...pool].sort(
      (a, b) =>
        count(b) - count(a) ||
        popularity(b) - popularity(a) ||
        a.name.localeCompare(b.name, "ro"),
    );
  }, [channels, live]);

  const watching = useMemo(
    () => trending.reduce((sum, channel) => sum + (live[channel.id] ?? 0), 0),
    [trending, live],
  );

  if (trending.length === 0) return null;

  return (
    <ChannelRail
      id={id ?? "trending"}
      eyebrow="Cele mai urmărite acum"
      title="Trending acum"
      channels={trending}
      guide={guide}
      onPlay={onPlay}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      viewsOf={(channel) => live[channel.id] ?? null}
      popularityOf={(channel) => channel.views ?? null}
      aside={
        <p className="shrink-0 text-xs tabular-nums text-ink-faint">
          <span className="text-ink-muted">{trending.length} canale</span>
          {watching > 0 && (
            <>
              {" · "}
              <span className="text-ink-muted">
                {formatViewers(watching)} în direct acum
              </span>
            </>
          )}
        </p>
      }
      className={className}
    />
  );
}
