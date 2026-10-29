"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Category, Channel } from "@/data/types";
import type { EpgGuide } from "@/components/now-next";
import { groupByCategory } from "@/lib/navigation";
import { TVChannelRow } from "./rail";
import { TVHero } from "./hero";

/**
 * The television's directory.
 *
 * The same catalogue as the website, arranged for a room rather than a
 * desk: one banner, then rows. The difference is not decoration — a
 * website can afford a grid of two hundred cards, because a pointer
 * crosses a grid quickly. A D-pad cannot. It crosses a *list*
 * quickly, and it is miserable in a grid.
 *
 * So the page is rows, and every row is a rail that wraps, and the first
 * thing the D-pad lands on is the banner's own **Redă acum**. The channel
 * a remote opens goes to the channel's screen, where the player lives;
 * this page never starts playback itself.
 */

export type TVDirectoryProps = {
  channels: Channel[];
  categories: Category[];
  guide?: EpgGuide | null;
  /** Our own live audience, measured at the proxy, keyed by channel id. */
  live?: Record<string, number>;
  featured?: Channel | null;
};

/** How many channels a row carries before it becomes a second catalogue. */
const ROW_LIMIT = 20;

export function TVDirectory({
  channels,
  categories,
  guide,
  live = {},
  featured,
}: TVDirectoryProps) {
  const router = useRouter();

  const onPlay = (channel: Channel) => router.push(`/canal/${channel.id}`);

  // What is on air right now, ordered by our own headcount. A channel
  // nobody is watching is not "live" for the purpose of this row, even if
  // the probe says the feed answers.
  const liveNow = useMemo(
    () =>
      channels
        .filter((channel) => (live[channel.id] ?? 0) > 0)
        .sort((a, b) => (live[b.id] ?? 0) - (live[a.id] ?? 0))
        .slice(0, ROW_LIMIT),
    [channels, live],
  );

  // One row per category the catalogue actually has channels in, in the
  // taxonomy's own order.
  const rows = useMemo(
    () =>
      groupByCategory(channels, categories).map((group) => ({
        id: group.id,
        title: group.label,
        channels: group.channels.slice(0, ROW_LIMIT),
      })),
    [channels, categories],
  );

  return (
    <>
      {featured ? (
        <TVHero
          channel={featured}
          onPlay={onPlay}
          onInfo={() => router.push(`/canal/${featured.id}`)}
          guide={guide}
          viewers={live[featured.id]}
        />
      ) : null}

      <div className="pt-6">
        <TVChannelRow
          title="În direct acum"
          channels={liveNow}
          onPlay={onPlay}
          guide={guide}
          qualityFor={(channel) => channel.quality}
          viewsFor={(channel) => live[channel.id]}
          popularityFor={(channel) => channel.views ?? null}
        />

        {rows.map((row) => (
          <TVChannelRow
            key={row.id}
            title={row.title}
            channels={row.channels}
            onPlay={onPlay}
            guide={guide}
            qualityFor={(channel) => channel.quality}
            viewsFor={(channel) => live[channel.id]}
            popularityFor={(channel) => channel.views ?? null}
          />
        ))}
      </div>
    </>
  );
}
