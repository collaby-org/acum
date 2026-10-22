"use client";

import Image from "next/image";
import { Eye, Heart, Play, Radio, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import type { CSSProperties, MouseEvent } from "react";
import type { EpgGuide } from "@/components/now-next";
import type { Quality } from "@/data/types";
import { QUALITY_META, STATUS_META, posterPalette } from "@/lib/channel-meta";
import { nowShowing } from "@/lib/now-showing";
import type { ChannelLike } from "@/lib/navigation";
import { cn, formatViewers } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Quality
 * ------------------------------------------------------------------ */

/** The quality a channel carries, when the catalogue knows it. */
export function channelQuality(channel: ChannelLike): Quality | undefined {
  const raw = (channel as { quality?: unknown }).quality;
  return typeof raw === "string" && raw in QUALITY_META
    ? (raw as Quality)
    : undefined;
}

/**
 * The quality badge.
 *
 * Standard definition earns none on its own — it is the floor, not a
 * feature — but a card is where feeds get compared side by side, so the
 * card asks for the floor to be named too (`showStandard`). The badge stays
 * quiet either way: a hairline ring and a muted label, so it never competes
 * with the channel name.
 */
export function QualityBadge({
  quality,
  className,
  showStandard = false,
}: {
  quality?: Quality | null;
  className?: string;
  /** Name the standard definition as well, so "not HD" is visible too. */
  showStandard?: boolean;
}) {
  if (!quality) return null;
  const meta = QUALITY_META[quality];
  if (!meta) return null;

  const standard = quality === "sd" || quality === "low";
  if (!meta.showBadge && !(showStandard && standard)) return null;

  return (
    <span
      data-slot="quality-badge"
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2",
        "text-[10px] font-semibold uppercase tracking-[0.14em]",
        standard
          ? "border-white/10 bg-white/[0.05] text-ink-faint"
          : "border-white/12 bg-white/8 text-ink-muted",
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * The screen
 * ------------------------------------------------------------------ */

/**
 * The family's own light, as a beam around the frame.
 *
 * The colour stops filling the card and starts rimming it. The sweep stays
 * inside the family's own hue — a shaft of light travelling around the
 * frame — and it fades out as it goes, so the card is lit on one side and
 * dark on the other. A rail of cards reads as a row of lit screens, not as
 * a row of outlines.
 */
function beamGradient(hue: number) {
  return [
    "conic-gradient(from 200deg at 50% 50%,",
    `hsl(${hue} 98% 74% / 1) 0%,`,
    `hsl(${hue} 95% 60% / 0.72) 10%,`,
    `hsl(${hue} 90% 50% / 0.42) 24%,`,
    `hsl(${hue} 86% 42% / 0.22) 42%,`,
    `hsl(${hue} 84% 36% / 0.12) 60%,`,
    `hsl(${hue} 88% 44% / 0.24) 78%,`,
    `hsl(${hue} 95% 62% / 0.78) 92%,`,
    `hsl(${hue} 98% 74% / 1) 100%)`,
  ].join(" ");
}

/** The plain family wash, kept as the floor under the still. */
function familyWash(palette: ReturnType<typeof posterPalette>) {
  return [
    `radial-gradient(130% 95% at 18% 0%, hsl(${palette.hue} 70% 30%) 0%, transparent 62%),`,
    `radial-gradient(100% 80% at 100% 100%, hsl(${palette.hue} 90% 58% / 0.42) 0%, transparent 58%),`,
    `linear-gradient(158deg, hsl(${(palette.hue + 18) % 360} 62% 16%) 0%, hsl(${(palette.hue + 330) % 360} 45% 8%) 100%)`,
  ].join(" ");
}

export type ChannelScreenProps = {
  channel: ChannelLike;
  /** The day's guide, so the screen can name what is on right now. */
  guide?: EpgGuide | null;
  /** The quality badge to show, when the caller knows it better. */
  badge?: Quality | null;
  /**
   * How many people are watching this channel here, right now. It is
   * measured at our own proxy, so it is a live crowd.
   */
  views?: number;
  /**
   * The source's cumulative popularity counter. It is a ranking, not an
   * audience, and it is never shown as one.
   */
  popularity?: number | null;
  /** Leaves room for a favourite button sitting over the corner. */
  reserve?: boolean;
  className?: string;
};

/**
 * A 16:9 "screen": the still of what the channel is airing right now, with
 * the channel's own logo as the broadcast bug, over a scrim that carries
 * the name, the quality and the show.
 *
 * The frame is a beam of the family's colour — one pixel of light around
 * the still, with the same light leaking out behind the card. The family's
 * wash stays underneath as the floor, so a channel the catalogue has no
 * still for still looks like a screen and not like a hole.
 */
export function ChannelScreen({
  channel,
  guide,
  badge,
  views,
  popularity: popularityProp,
  reserve = false,
  className,
}: ChannelScreenProps) {
  const palette = posterPalette(channel.familyKey, channel.category);
  const isLive = channel.status === "live";
  const quality = badge ?? channelQuality(channel);
  const poster = channel.poster ?? null;

  // What is on right now, read off the guide.
  const show = useMemo(() => nowShowing(guide, channel), [guide, channel]);

  const viewers = views ?? 0;
  const popularity = popularityProp ?? channel.views ?? 0;
  // The source counts viewers for a channel only while it is on air, so a
  // count is a live signal even when our own probe could not confirm it.
  const onAir = isLive || viewers > 0 || popularity > 0;
  const beam = beamGradient(palette.hue);

  return (
    <div
      className={cn(
        "relative aspect-video w-full rounded-[var(--radius-card)] p-px",
        className,
      )}
      style={{ background: beam }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[calc(var(--radius-card)_-_1px)] bg-surface-2">
        {/* The family's wash — the floor under everything else. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: familyWash(palette) }}
        />

        {/* The still of the show on air. */}
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            sizes="(max-width: 640px) 248px, 272px"
            className="object-cover"
            unoptimized
            onError={(event) => {
              // A still the catalogue points at but does not ship: the
              // family's wash underneath takes over.
              event.currentTarget.style.opacity = "0";
            }}
          />
        ) : null}

        {/* The still is dimmed, so the type always reads over it. */}
        <div aria-hidden className="absolute inset-0 bg-black/20" />

        {/* Broadcast scanlines */}
        <div
          aria-hidden
          className="absolute inset-0 fx-scanline opacity-60 mix-blend-overlay"
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
          className="absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-black/92 via-black/42 to-transparent"
        />

        {/* Broadcast bug — the channel's own logo. The HD lockup is used
            when the channel is actually on an HD feed, and dark artwork
            gets a light plate so it stays legible. */}
        {channel.logo ? (
          <span
            className={cn(
              "absolute left-3 top-3 flex h-8 items-center rounded-[7px] px-1.5 backdrop-blur-md fx-edge",
              channel.logoDark ? "bg-white/92" : "bg-black/55",
            )}
          >
            <Image
              src={
                quality && ["hd", "fhd", "uhd"].includes(quality)
                  ? (channel.logoHd ?? channel.logo)
                  : channel.logo
              }
              alt=""
              width={48}
              height={24}
              className="h-6 w-12 object-contain"
              unoptimized
            />
          </span>
        ) : (
          <span
            aria-hidden
            className="absolute left-3 top-3 grid h-7 min-w-10 place-items-center rounded-[7px] bg-black/55 px-1.5 font-display text-[11px] font-bold tracking-tight text-ink/80 backdrop-blur-md fx-edge"
          >
            {channel.name.slice(0, 2).toUpperCase()}
          </span>
        )}

        {/* Status — never a fake live badge on a dead channel.
            Two different numbers can be here and they must not be confused:
            the **live** count is ours, measured at the proxy, and it carries
            the eye; the source's **popularity** counter is cumulative, so it
            carries a chart and a dimmer tone. A visitor should never read a
            ranking as a crowd. */}
        <span className="absolute right-3 top-3 flex h-6 items-center gap-1.5 rounded-full bg-black/55 px-2 backdrop-blur-md fx-edge">
          {onAir ? (
            <span
              aria-hidden
              className="relative size-1.5 rounded-full bg-live fx-live-eye"
            />
          ) : (
            <Radio aria-hidden className="size-3 text-ink-faint" />
          )}
          {viewers > 0 ? (
            <>
              <span aria-hidden className="h-3 w-px bg-white/25" />
              <Eye aria-hidden className="size-3 text-ink-muted" />
              <span className="text-[10px] font-semibold tabular-nums tracking-[0.02em] text-ink">
                {formatViewers(viewers)}
              </span>
            </>
          ) : popularity > 0 ? (
            <>
              <span aria-hidden className="h-3 w-px bg-white/25" />
              <TrendingUp aria-hidden className="size-3 text-ink-faint" />
              <span
                className="text-[10px] font-semibold tabular-nums tracking-[0.02em] text-ink-muted"
                title="Cele mai urmărite — un clasament, nu o audiență în direct"
              >
                {formatViewers(popularity)}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-live-soft">
              Live
            </span>
          )}
        </span>

        {/* Title block — the name with its quality, then what is on. */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 p-3.5",
            reserve ? "pr-14" : "pr-3.5",
          )}
        >
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 truncate font-display text-[15px] font-semibold leading-[1.15] tracking-tight text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
              {channel.name}
            </h3>
            <QualityBadge quality={quality} showStandard className="shrink-0" />
          </div>

          <p className="mt-1 flex min-w-0 items-center gap-1.5">
            {show ? (
              <>
                <span
                  className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: `hsl(${palette.hue} 85% 70%)` }}
                >
                  Acum
                </span>
                <span className="min-w-0 truncate text-[11.5px] leading-tight text-ink-muted/90">
                  {show}
                </span>
              </>
            ) : (
              <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted/70">
                {channel.family}
              </span>
            )}
          </p>
        </div>

        {/* Play affordance */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-[var(--dur-base,300ms)] group-hover/card:opacity-100 group-focus-within/card:opacity-100 motion-reduce:transition-none"
        >
          <span className="grid size-12 place-items-center rounded-full bg-signal text-signal-ink shadow-[var(--shadow-glow)] transition-transform duration-[var(--dur-base,300ms)] group-hover/card:scale-110 motion-reduce:transition-none motion-reduce:scale-100">
            <Play className="size-5 translate-x-[1px] fill-current" />
          </span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The card
 * ------------------------------------------------------------------ */

type ChannelCardProps<T extends ChannelLike> = {
  channel: T;
  onPlay: (channel: T) => void;
  isFavorite: boolean;
  onToggleFavorite: (
    channel: T,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  /** The day's guide, so the card can name what is on right now. */
  guide?: EpgGuide | null;
  /** The picture quality, when the caller knows it better than the channel does. */
  quality?: Quality | null;
  /** How many people are watching right now, when the caller knows. */
  views?: number | null;
  /**
   * The source's cumulative popularity counter, when the caller knows it.
   * It is a ranking, and the card gives it a different mark from the live
   * count so the two are never read as the same thing.
   */
  popularity?: number | null;
  className?: string;
  /** Position inside its rail — used by the keyboard navigation. */
  index?: number;
};

/**
 * A 16:9 "screen" with the channel's own logo as the broadcast bug, over
 * the still of what is playing right now, rimmed by a beam of the family's
 * colour. The whole screen is one button; the favourite control is a
 * sibling, never nested inside it.
 *
 * The card grows on hover, so it needs room on every side: the rail keeps
 * that room inside the scroller, and the card itself lifts above its
 * neighbours instead of sliding under them.
 */
export function ChannelCard<T extends ChannelLike>({
  channel,
  onPlay,
  isFavorite,
  onToggleFavorite,
  guide,
  quality,
  views,
  popularity,
  className,
  index,
}: ChannelCardProps<T>) {
  const palette = posterPalette(channel.familyKey, channel.category);
  const status = STATUS_META[channel.status];
  const viewers = views ?? 0;
  const popular = popularity ?? channel.views ?? 0;
  // The source counts viewers for a channel only while it is on air, so a
  // count is a live signal even when our own probe could not confirm it.
  const onAir = channel.status === "live" || viewers > 0 || popular > 0;

  const playLabel = [
    `Vizionează ${channel.name}`,
    onAir ? "live acum" : status.label.toLowerCase(),
    viewers > 0 ? `${viewers.toLocaleString("ro-RO")} de spectatori` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article
      data-channel-id={channel.id}
      data-card-index={index}
      className={cn(
        "group/card relative z-0 w-[248px] shrink-0 sm:w-[272px]",
        "transition-[transform,box-shadow] duration-[var(--dur-base,300ms)]",
        "hover:z-10 hover:-translate-y-1 hover:scale-[1.035] hover:shadow-[var(--shadow-e3)]",
        "focus-within:z-10 focus-within:-translate-y-1 focus-within:scale-[1.035]",
        "motion-reduce:transition-none motion-reduce:translate-y-0! motion-reduce:scale-100!",
        className,
      )}
      style={{
        transitionTimingFunction:
          "var(--ease-spring, var(--ease-out-expo, cubic-bezier(0.22, 1, 0.36, 1)))",
      }}
    >
      {/* The light that leaks out of the frame. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-1 z-0 rounded-[calc(var(--radius-card)_+_4px)] opacity-45 blur-[14px] transition-opacity duration-[var(--dur-slow,600ms)] group-hover/card:opacity-85 motion-reduce:transition-none"
        style={{ background: beamGradient(palette.hue) }}
      />

      <button
        type="button"
        data-card-action="play"
        onClick={() => onPlay(channel)}
        aria-label={playLabel}
        className="relative z-[1] block w-full cursor-pointer rounded-[var(--radius-card)] text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        <ChannelScreen
          channel={channel}
          guide={guide}
          badge={quality}
          views={viewers}
          popularity={popular}
          reserve
        />
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
          "absolute bottom-2.5 right-2.5 z-10 grid size-11 place-items-center rounded-full bg-black/55 text-ink-faint backdrop-blur-md fx-edge fx-press",
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
