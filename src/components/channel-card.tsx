"use client";

import Image from "next/image";
import { Heart, Play, Radio } from "lucide-react";
import type { Channel } from "@/data/channels";
import { STATUS_META, posterPalette } from "@/lib/channel-meta";
import { cn } from "@/lib/utils";

function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full bg-live",
        className ?? "animate-[pulse-live_1.9s_ease-in-out_infinite]",
      )}
    />
  );
}

type ChannelCardProps = {
  channel: Channel;
  onPlay: (channel: Channel) => void;
  isFavorite: boolean;
  onToggleFavorite: (
    channel: Channel,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void;
  className?: string;
};

export function ChannelCard({
  channel,
  onPlay,
  isFavorite,
  onToggleFavorite,
  className,
}: ChannelCardProps) {
  const palette = posterPalette(channel.familyKey, channel.category);
  const status = STATUS_META[channel.status];
  const isLive = channel.status === "live";

  return (
    <article
      className={cn(
        "group relative w-[248px] shrink-0 sm:w-[272px]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onPlay(channel)}
        aria-label={`Vizionează ${channel.name}`}
        className="block w-full cursor-pointer text-left"
      >
        <div
          className={cn(
            "relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] border border-white/8 bg-surface-2",
            "transition-[transform,box-shadow,border-color] duration-300 ease-out",
            "group-hover:-translate-y-1 group-hover:scale-[1.03] group-hover:border-white/20",
            "group-hover:shadow-[0_22px_50px_-24px_rgba(0,0,0,0.95)]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
          )}
        >
          {/* Poster backdrop */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `radial-gradient(130% 95% at 18% 0%, ${palette.from} 0%, transparent 62%), radial-gradient(100% 80% at 100% 100%, ${palette.glow} 0%, transparent 58%), linear-gradient(158deg, ${palette.via} 0%, ${palette.to} 100%)`,
            }}
          />

          {/* Broadcast scanlines */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.22] mix-blend-overlay"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)",
            }}
          />

          {/* Vignette */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_45%,transparent_35%,rgba(0,0,0,0.62)_100%)]"
          />

          {/* Channel bug */}
          {channel.logo && (
            <div className="absolute left-3 top-3 flex h-7 items-center rounded-[7px] bg-black/55 px-1.5 backdrop-blur-sm">
              <Image
                src={channel.logo}
                alt=""
                width={40}
                height={20}
                className="h-5 w-10 object-contain"
                unoptimized
              />
            </div>
          )}

          {/* Status */}
          <div className="absolute right-3 top-3 flex h-6 items-center gap-1.5 rounded-full bg-black/55 px-2 backdrop-blur-sm">
            {isLive ? (
              <>
                <LiveDot />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ff8b93]">
                  Live
                </span>
              </>
            ) : (
              <>
                <Radio aria-hidden className="size-3 text-ink-faint" />
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                  {status.label}
                </span>
              </>
            )}
          </div>

          {/* Title block */}
          <div className="absolute inset-x-0 bottom-0 p-3.5">
            <h3 className="font-display text-[15px] font-semibold leading-[1.15] tracking-tight text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              {channel.name}
            </h3>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted/80">
              {channel.family}
            </p>
          </div>

          {/* Hover affordance */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="grid size-12 place-items-center rounded-full bg-signal text-[#141005] shadow-[0_10px_30px_-8px_rgba(240,165,0,0.9)]">
              <Play className="size-5 translate-x-[1px] fill-current" />
            </span>
          </div>
        </div>
      </button>

      {/* Favourite */}
      <button
        type="button"
        onClick={(event) => onToggleFavorite(channel, event)}
        aria-label={
          isFavorite
            ? `Elimină ${channel.name} din favorite`
            : `Adaugă ${channel.name} la favorite`
        }
        aria-pressed={isFavorite}
        className={cn(
          "absolute bottom-2.5 right-2.5 z-10 grid size-8 place-items-center rounded-full border border-white/10 bg-black/55 backdrop-blur-sm",
          "transition-[transform,color,background-color,border-color] duration-200 hover:scale-110",
          isFavorite
            ? "text-signal"
            : "text-ink-faint hover:border-white/25 hover:text-ink",
        )}
      >
        <Heart
          className={cn("size-4 transition-transform", isFavorite && "fill-current")}
        />
      </button>
    </article>
  );
}
