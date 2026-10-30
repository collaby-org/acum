"use client";

import Image from "next/image";
import { Eye, Heart, Play, Radio, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import Link from "next/link";
import type { MouseEvent } from "react";
import type { EpgGuide } from "@/components/now-next";
import type { Quality } from "@/data/types";
import { QUALITY_META, STATUS_META, posterPalette } from "@/lib/channel-meta";
import { nowProgramme } from "@/lib/now-showing";
import { useGuideMoment } from "@/hooks/use-guide-clock";
import { pictureFor, slotFor, stillUrl } from "@/lib/stills";
import type { ChannelLike } from "@/lib/navigation";
import { cn, formatViewers } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "@/hooks/use-account";
import { isAdmin } from "@/lib/admin-access";

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
 * The family's own light, as a luminous edge.
 *
 * The colour does not fill the card and it does not blur out of it. It
 * runs along the edge as a ring of light — brightest at the top, where the
 * light comes from, and fading as it goes down — and it is painted only
 * when the card is hovered or focused. An idle card costs nothing.
 */
function rimGradient(hue: number) {
  return [
    "linear-gradient(180deg,",
    `hsl(${hue} 85% 82% / 0.9) 0%,`,
    `hsl(${hue} 70% 60% / 0.45) 40%,`,
    `hsl(${hue} 60% 48% / 0.14) 100%)`,
  ].join(" ");
}

/**
 * The one soft source of light on the card.
 *
 * It sits inside the frame, so it cannot reach the neighbour, and it is
 * anchored above the top edge — the picture catches the light, the way a
 * screen does in a dark room. One source, one falloff, no overlap.
 */
function pictureLight(hue: number) {
  return [
    "radial-gradient(120% 88% at 50% -8%,",
    `hsl(${hue} 96% 76% / 0.48) 0%,`,
    `hsl(${hue} 90% 62% / 0.18) 38%,`,
    "transparent 70%)",
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

  /**
   * The moment the guide is read against. It is the real clock, corrected
   * by the server's stamp, and it turns over once a minute — so the show
   * named here is the show that is on now, and it stops being that show
   * when another one starts.
   */
  const moment = useGuideMoment(guide?.reference);

  /**
   * What is on right now, read off the guide, and the picture that belongs
   * to it. The still is the one captured for the slot on air; when there is
   * none yet, the newest still of the channel stands in until the capture
   * pipeline has caught up.
   */
  const programme = useMemo(
    () => nowProgramme(guide, channel, moment),
    [guide, channel, moment],
  );
  const picture = useMemo(
    () => pictureFor(channel.stills, programme, moment),
    [channel.stills, programme, moment],
  );
  const captured = picture.still?.file ?? null;

  /**
   * The frame a visitor filed for the slot on air, if there is one.
   *
   * Nothing is read to learn this. The slot names the object, so the card
   * computes the address and tries it — and an object that is not there
   * yet answers with a 404, which the `onError` below hands back to the
   * family's wash. A missing still costs one request and no picture.
   */
  const frame = useMemo(
    () => stillUrl(channel.id, slotFor(programme)),
    [channel, programme],
  );

  // A still the catalogue vouches for still wins. The live frame is the
  // next best thing, and the family wash stays under both.
  const poster = captured ?? frame;

  const account = useAccount();
  const showUpgrade =
    account.ready &&
    account.plan === "free" &&
    !isAdmin(account.email, account.plan);

  const viewers = views ?? 0;
  const popularity = popularityProp ?? channel.views ?? 0;
  // The source counts viewers for a channel only while it is on air, so a
  // count is a live signal even when our own probe could not confirm it.
  const onAir = isLive || viewers > 0 || popularity > 0;

  return (
    <div
      className={cn(
        "relative aspect-video w-full rounded-[var(--radius-card)] p-px",
        className,
      )}
      // A hairline at rest. The family's colour arrives with the light.
      style={{ background: "rgb(255 255 255 / 0.08)" }}
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

        {/* Broadcast scanlines. No blend mode: a blend here would drag
            every card out of the compositor's fast path, and the lines are
            faint enough to read the same laid over the still. */}
        <div aria-hidden className="absolute inset-0 fx-scanline opacity-50" />

        {/* Vignette */}
        <div aria-hidden className="absolute inset-0 fx-vignette" />

        {/* The light the picture throws. One source, anchored above the
            top edge, clipped by the frame so it never reaches the card
            next to it. It is painted only when the card is hovered or
            focused — an idle card paints nothing. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-0 transition-opacity duration-[var(--dur-base,300ms)] group-hover/card:opacity-100 group-focus-within/card:opacity-100 motion-reduce:transition-none"
          style={{ background: pictureLight(palette.hue) }}
        />

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
              "absolute left-3 top-3 flex h-8 items-center rounded-[7px] px-1.5 fx-edge",
              channel.logoDark ? "bg-white/92" : "bg-black/72",
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
            className="absolute left-3 top-3 grid h-7 min-w-10 place-items-center rounded-[7px] bg-black/72 px-1.5 font-display text-[11px] font-bold tracking-tight text-ink/80 fx-edge"
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
        <span className="absolute right-3 top-3 flex h-6 items-center gap-1.5 rounded-full bg-black/72 px-2 fx-edge">
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
            {programme ? (
              <>
                <span
                  className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: `hsl(${palette.hue} 85% 70%)` }}
                >
                  Acum
                </span>
                <span className="min-w-0 truncate text-[11.5px] leading-tight text-ink-muted/90">
                  {programme.title}
                </span>
              </>
            ) : (
              <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted/70">
                {channel.family}
              </span>
            )}
          </p>

          {showUpgrade ? (
            <Link
              href="/preturi"
              className="mt-1.5 inline-block shrink-0"
              aria-label="Planuri și abonamente"
            >
              <Badge
                variant="signal"
                size="xs"
                className="h-5 px-2 text-[10px] font-semibold tracking-[0.1em] text-signal-ink"
              >
                Upgradează
              </Badge>
            </Link>
          ) : null}
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

      {/* The luminous edge. A ring of light in the family's own colour,
          one pixel wide, brightest at the top where the light comes from.
          It is drawn over the frame and clipped to it, so it lights the
          card and nothing else. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[var(--radius-card)] fx-rim opacity-0 transition-opacity duration-[var(--dur-base,300ms)] group-hover/card:opacity-100 group-focus-within/card:opacity-100 motion-reduce:transition-none"
        style={{ background: rimGradient(palette.hue) }}
      />
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
 * the still of what is playing right now, rimmed by a ring of light in the
 * family's colour. The whole screen is one button; the favourite control
 * is a sibling, never nested inside it.
 *
 * The card grows on hover, so it needs room on every side: the rail keeps
 * that room inside the scroller, and the card itself lifts above its
 * neighbours instead of sliding under them.
 *
 * What the hover changes is the light, not the geometry of the page: the
 * rim and the picture's own glow fade in, the card lifts, and only the
 * transform is animated.
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
        // Only the transform is animated. A shadow that changes is a
        // repaint of a large area on every frame of the hover, and the
        // light on the card is already carried by the rim.
        "transition-transform duration-[var(--dur-base,300ms)]",
        "hover:z-10 hover:-translate-y-1 hover:scale-[1.035]",
        "focus-within:z-10 focus-within:-translate-y-1 focus-within:scale-[1.035]",
        "motion-reduce:transition-none motion-reduce:translate-y-0! motion-reduce:scale-100!",
        // The card paints on its own: a hover here cannot repaint the
        // page around it.
        "[contain:layout_paint]",
        className,
      )}
      style={{
        transitionTimingFunction:
          "var(--ease-spring, var(--ease-out-expo, cubic-bezier(0.22, 1, 0.36, 1)))",
      }}
    >
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
          "absolute bottom-2.5 right-2.5 z-10 grid size-11 place-items-center rounded-full bg-black/72 text-ink-faint fx-edge fx-press",
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
