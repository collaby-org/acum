"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Channel } from "@/data/channels";
import { ChannelCard } from "@/components/channel-card";

type ChannelRailProps = {
  title: string;
  eyebrow?: string;
  channels: Channel[];
  onPlay: (channel: Channel) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (
    channel: Channel,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void;
};

export function ChannelRail({
  title,
  eyebrow,
  channels,
  onPlay,
  isFavorite,
  onToggleFavorite,
}: ChannelRailProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft >= max - 4 });
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
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.82), behavior: "smooth" });
  };

  if (channels.length === 0) return null;

  return (
    <section className="group/rail relative py-7 sm:py-9">
      <div className="mb-4 flex items-end justify-between gap-4 px-4 sm:px-8 lg:px-12">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-xl font-semibold tracking-tight sm:text-[26px]">
            {title}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity duration-300 focus-within:opacity-100 group-hover/rail:opacity-100">
            <button
              type="button"
              onClick={() => nudge(-1)}
              disabled={edges.start}
              aria-label="Derulează la stânga"
              className="grid size-9 place-items-center rounded-full border border-white/12 bg-black/50 text-ink transition hover:border-white/30 hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronLeft className="size-4.5" />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              disabled={edges.end}
              aria-label="Derulează la dreapta"
              className="grid size-9 place-items-center rounded-full border border-white/12 bg-black/50 text-ink transition hover:border-white/30 hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>
      </div>

      <div
        ref={scroller}
        onScroll={sync}
        className="flex gap-3.5 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-8 lg:px-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            onPlay={onPlay}
            isFavorite={isFavorite(channel.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
