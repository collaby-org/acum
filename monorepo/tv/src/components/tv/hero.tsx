"use client";

import Image from "next/image";
import { Play, Users } from "lucide-react";
import { useMemo } from "react";
import type { EpgGuide } from "@/components/now-next";
import { posterPalette } from "@/lib/channel-meta";
import { nowShowing } from "@/lib/now-showing";
import { useGuideMoment } from "@/hooks/use-guide-clock";
import type { ChannelLike } from "@/lib/navigation";
import { cn, formatViewers } from "@/lib/utils";
import { TVFocusable } from "./focusable";

/**
 * The banner a television opens on.
 *
 * One channel, at ten times the size of a web hero, with the family's own
 * colour running through it: the still of what is on air behind, a bloom
 * of the channel's hue screen-blended over it, a scrim falling to the
 * bottom-left where the type sits.
 *
 * Two buttons, and the order is the whole design. **Redă acum** is gold
 * and carries the glow — it is what the user came for, and the D-pad
 * lands on it first. **Programul** beside it is quieter and secondary.
 * On a television the first thing focused wins, so the first thing
 * focused is here.
 */

export type TVHeroProps<T extends ChannelLike> = {
  channel: T;
  onPlay: (channel: T) => void;
  /** Where the secondary action goes. A hero without one is a dead end. */
  onInfo?: (channel: T) => void;
  /** The day's guide, so the banner can name what is on right now. */
  guide?: EpgGuide | null;
  /** How many people are watching right here, right now. */
  viewers?: number | null;
  className?: string;
};

export function TVHero<T extends ChannelLike>({
  channel,
  onPlay,
  onInfo,
  guide,
  viewers,
  className,
}: TVHeroProps<T>) {
  const palette = posterPalette(channel.familyKey, channel.category);
  const moment = useGuideMoment(guide?.reference);

  const programme = useMemo(
    () => nowShowing(guide, channel, moment),
    [guide, channel, moment],
  );

  // The newest still of the channel. The hero is a banner, not the card's
  // precise "what is on this minute" slot, so the newest frame of the day
  // is the honest one to hang behind the name.
  const still = channel.stills?.[0]?.file ?? null;
  const audience = viewers ?? 0;

  return (
    <section
      data-tv-hero=""
      className={cn("relative isolate overflow-hidden", className)}
    >
      {/* The still, dimmed so the type always wins. */}
      {still ? (
        <Image
          src={still}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
          unoptimized
        />
      ) : null}

      {/* The family's own light, screen-blended so it stays luminous over
          the near-black rather than turning to mud. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 mix-blend-screen"
        style={{
          background: [
            `radial-gradient(58% 70% at 22% 8%, hsl(${palette.hue} 92% 56% / 0.34) 0%, transparent 68%)`,
            `radial-gradient(44% 58% at 88% 14%, hsl(${(palette.hue + 48) % 360} 88% 54% / 0.22) 0%, transparent 70%)`,
            "radial-gradient(70% 60% at 50% 108%, rgb(242 167 27 / 0.16) 0%, transparent 74%)",
          ].join(", "),
        }}
      />

      {/* The fallback wash, and the scrim the type sits on. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(200deg, rgb(4 5 10 / 0.28) 0%, rgb(4 5 10 / 0.78) 62%, rgb(4 5 10 / 0.94) 100%)",
        }}
      />
      <div aria-hidden className="absolute inset-0 fx-scanline opacity-30" />
      <div aria-hidden className="absolute inset-0 fx-vignette" />

      <div className="relative z-[2] grid min-h-[30rem] content-end gap-5 pb-12 tv-safe-area">
        <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-signal/90">
          <span aria-hidden className="relative grid size-2.5 place-items-center">
            <span aria-hidden className="absolute inset-0 rounded-full bg-live fx-halo" />
            <span className="relative size-2.5 rounded-full bg-live" />
          </span>
          În direct acum
        </p>

        <h1 className="font-display text-tv-hero font-bold leading-[0.98] tracking-[-0.04em] text-balance">
          <span className="bg-gradient-to-b from-white to-white/[0.78] bg-clip-text text-transparent">
            {channel.name}
          </span>
        </h1>

        <p className="max-w-xl text-tv-body leading-relaxed text-ink-muted">
          {programme ? (
            <>
              <span className="font-semibold text-ink">Acum: </span>
              {programme}
            </>
          ) : (
            channel.family
          )}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-4">
          <TVFocusable
            onClick={() => onPlay(channel)}
            ring="soft"
            aria-label={`Redă ${channel.name} acum`}
            className="inline-flex h-16 items-center gap-3 rounded-full bg-signal px-9 text-tv-caption font-semibold tracking-[-0.01em] text-signal-ink shadow-[var(--shadow-glow)] hover:bg-signal-bright"
          >
            <Play className="size-5 translate-x-[1px] fill-current" />
            Redă acum
          </TVFocusable>

          {onInfo ? (
            <TVFocusable
              onClick={() => onInfo(channel)}
              ring="soft"
              className="inline-flex h-16 items-center gap-2 rounded-full border border-white/16 bg-white/[0.06] px-8 text-tv-caption font-medium text-ink backdrop-blur-md hover:border-white/28 hover:bg-white/[0.1]"
            >
              Programul
            </TVFocusable>
          ) : null}

          {audience > 0 ? (
            <span className="ml-1 inline-flex items-center gap-2 text-tv-caption text-ink-muted">
              <Users aria-hidden className="size-4 text-ink-faint" />
              {formatViewers(audience)} se uită acum
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
