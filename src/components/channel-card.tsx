"use client";

import Image from "next/image";
import { Heart, Layers, Play, Radio } from "lucide-react";
import type { CSSProperties, MouseEvent } from "react";
import { STATUS_META, posterPalette, serverSummary } from "@/lib/channel-meta";
import type { ChannelLike } from "@/lib/navigation";
import { cn, plural } from "@/lib/utils";

type ChannelCardProps<T extends ChannelLike> = {
  channel: T;
  onPlay: (channel: T) => void;
  isFavorite: boolean;
  onToggleFavorite: (
    channel: T,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  className?: string;
  /** Position inside its rail — used by the keyboard navigation. */
  index?: number;
};

/**
 * A 16:9 "screen" with the channel's own logo as the broadcast bug, over a
 * backdrop derived from its family colour. The whole screen is one button;
 * the favourite control is a sibling, never nested inside it.
 */
export function ChannelCard<T extends ChannelLike>({
  channel,
  onPlay,
  isFavorite,
  onToggleFavorite,
  className,
  index,
}: ChannelCardProps<T>) {
  const palette = posterPalette(channel.familyKey, channel.category);
  const status = STATUS_META[channel.status];
  const isLive = channel.status === "live";
  const feeds = channel.servers ?? [];
  const stacked = feeds.length > 1;
  const summary = serverSummary(channel);

  const playLabel = [
    `Vizionează ${channel.name}`,
    isLive ? "live acum" : status.label.toLowerCase(),
    stacked ? plural(feeds.length, "server", "servere", "de servere") : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article
      data-channel-id={channel.id}
      data-card-index={index}
      className={cn(
        "group/card relative w-[248px] shrink-0 sm:w-[272px]",
        "fx-lift motion-reduce:transform-none!",
        className,
      )}
    >
      <button
        type="button"
        data-card-action="play"
        onClick={() => onPlay(channel)}
        aria-label={playLabel}
        className="block w-full cursor-pointer rounded-[var(--radius-card)] text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        <div
          className={cn(
            "relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] bg-surface-2 fx-edge",
            "transition-[transform,box-shadow] duration-[var(--dur-base,300ms)]",
            "group-hover/card:-translate-y-px group-hover/card:scale-[1.02]",
            "group-hover/card:shadow-[var(--shadow-e4)]",
            "motion-reduce:transition-none motion-reduce:translate-y-0! motion-reduce:scale-100!",
          )}
          style={{
            transitionTimingFunction:
              "var(--ease-spring, var(--ease-out-expo, cubic-bezier(0.22, 1, 0.36, 1)))",
          }}
        >
          {/* Procedural backdrop, derived from the family colour */}
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
            className="absolute inset-0 fx-scanline opacity-70 mix-blend-overlay"
          />

          {/* Light bloom, on hover only */}
          <div
            aria-hidden
            className="absolute inset-0 fx-bloom opacity-0 transition-opacity duration-[var(--dur-slow,600ms)] group-hover/card:opacity-100 motion-reduce:transition-none"
            style={{ "--fx-bloom-color": palette.glow } as CSSProperties}
          />

          {/* Vignette */}
          <div aria-hidden className="absolute inset-0 fx-vignette" />

          {/* Scrim under the title block */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/35 to-transparent"
          />

          {/* Broadcast bug — the channel's own logo, at its native 40×20 */}
          {channel.logo ? (
            <span className="absolute left-3 top-3 flex h-7 items-center rounded-[7px] bg-black/45 px-1.5 backdrop-blur-sm fx-edge">
              <Image
                src={channel.logo}
                alt=""
                width={40}
                height={20}
                className="h-5 w-10 object-contain"
                unoptimized
              />
            </span>
          ) : (
            <span
              aria-hidden
              className="absolute left-3 top-3 grid h-7 min-w-10 place-items-center rounded-[7px] bg-black/45 px-1.5 font-display text-[11px] font-bold tracking-tight text-ink/80 backdrop-blur-sm fx-edge"
            >
              {channel.name.slice(0, 2).toUpperCase()}
            </span>
          )}

          {/* Status — never a fake live badge on a dead channel */}
          <span className="absolute right-3 top-3 flex h-6 items-center gap-1.5 rounded-full bg-black/45 px-2 backdrop-blur-sm fx-edge">
            {isLive ? (
              <>
                <span
                  aria-hidden
                  className="relative size-1.5 rounded-full bg-live fx-live-eye"
                />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-live-soft">
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
          </span>

          {/* Title block */}
          <div className="absolute inset-x-0 bottom-0 p-3.5 pr-14">
            <h3 className="font-display text-[15px] font-semibold leading-[1.15] tracking-tight text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              {channel.name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted/80">
                {channel.family}
              </p>
              {stacked && (
                <span
                  title={plural(feeds.length, "server", "servere", "de servere")}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-ink-muted backdrop-blur-sm fx-edge"
                >
                  <Layers aria-hidden className="size-2.5" />
                  {summary}
                </span>
              )}
            </div>
          </div>

          {/* Play affordance */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-[var(--dur-base,300ms)] group-hover/card:opacity-100 group-focus-visible/card:opacity-100 motion-reduce:transition-none"
          >
            <span className="grid size-12 place-items-center rounded-full bg-signal text-signal-ink shadow-[var(--shadow-glow)] transition-transform duration-[var(--dur-base,300ms)] group-hover/card:scale-110 motion-reduce:transition-none motion-reduce:scale-100">
              <Play className="size-5 translate-x-[1px] fill-current" />
            </span>
          </span>
        </div>
      </button>

      {/* Favourite — sibling of the play button, never inside it */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(channel, event);
        }}
        aria-label={
          isFavorite
            ? `Elimină ${channel.name} din favorite`
            : `Adaugă ${channel.name} la favorite`
        }
        aria-pressed={isFavorite}
        className={cn(
          "absolute bottom-2.5 right-2.5 z-10 grid size-11 place-items-center rounded-full bg-black/45 text-ink-faint backdrop-blur-sm fx-edge fx-press",
          "transition-[transform,color,background-color] duration-[var(--dur-fast,150ms)]",
          "hover:scale-105 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
          "motion-reduce:transition-none motion-reduce:scale-100",
          isFavorite && "text-signal",
        )}
      >
        <Heart
          aria-hidden
          className={cn(
            "size-4 transition-transform duration-[var(--dur-fast,150ms)]",
            isFavorite && "fill-current",
          )}
        />
      </button>
    </article>
  );
}
