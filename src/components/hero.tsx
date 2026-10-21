"use client";

import Image from "next/image";
import { Heart, Play, Radio, Signal } from "lucide-react";
import type { Channel } from "@/data/channels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { posterPalette } from "@/lib/channel-meta";
import { cn } from "@/lib/utils";

type HeroProps = {
  channel: Channel;
  liveCount: number;
  totalCount: number;
  isFavorite: boolean;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  onBrowse: () => void;
};

export function Hero({
  channel,
  liveCount,
  totalCount,
  isFavorite,
  onPlay,
  onToggleFavorite,
  onBrowse,
}: HeroProps) {
  const palette = posterPalette(channel.familyKey, channel.category);
  const live = channel.status === "live";

  return (
    <section className="relative isolate overflow-hidden pb-16 pt-28 sm:pb-24 sm:pt-36 lg:pb-32">
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(120% 85% at 12% 0%, ${palette.from} 0%, transparent 58%), radial-gradient(85% 70% at 88% 12%, ${palette.glow} 0%, transparent 60%), linear-gradient(180deg, #06070a 0%, ${palette.to} 100%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0.45) 0px, rgba(255,255,255,0.45) 1px, transparent 1px, transparent 4px)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-56 bg-gradient-to-t from-canvas via-canvas/70 to-transparent"
      />

      <div className="mx-auto grid max-w-[1800px] items-center gap-10 px-4 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-12">
        {/* Copy */}
        <div className="animate-[fade-up_0.6s_cubic-bezier(0.22,1,0.36,1)_both]">
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <Badge variant="live" size="sm">
              <span className="size-1.5 animate-[pulse-live_1.9s_ease-in-out_infinite] rounded-full bg-live" />
              În direct
            </Badge>
            <Badge variant="signal" size="sm">
              {channel.family}
            </Badge>
            {live && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
                <Signal className="size-3.5" />
                Player verificat
              </span>
            )}
          </div>

          <h1 className="font-display text-[clamp(2.6rem,7vw,5.2rem)] font-bold leading-[0.94] tracking-[-0.03em] text-balance">
            {channel.name}
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-muted sm:text-base">
            {channel.family} — unul dintre cele{" "}
            <span className="font-semibold text-ink">{totalCount}</span> canale
            adunate în VIZOR. Fără cont, fără reclame, fără pauze: doar canalul
            și un player care pornește imediat.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => onPlay(channel)}>
              <Play className="size-4.5 fill-current" />
              Vizionează acum
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => onToggleFavorite(channel)}
              aria-pressed={isFavorite}
            >
              <Heart className={cn("size-4.5", isFavorite && "fill-current")} />
              {isFavorite ? "Salvat" : "Adaugă la favorite"}
            </Button>
            <Button size="lg" variant="ghost" onClick={onBrowse}>
              <Radio className="size-4.5" />
              {liveCount} canale active
            </Button>
          </div>
        </div>

        {/* Screen mock */}
        <div className="relative hidden justify-self-end lg:block">
          <div
            className="relative aspect-video w-[520px] max-w-full overflow-hidden rounded-2xl border border-white/12 shadow-[0_50px_120px_-40px_rgba(0,0,0,1)]"
            style={{
              background: `radial-gradient(130% 100% at 20% 0%, ${palette.from} 0%, transparent 60%), linear-gradient(158deg, ${palette.via} 0%, ${palette.to} 100%)`,
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-25 mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)",
              }}
            />
            <div className="absolute inset-0 grid place-items-center p-10 text-center">
              <div>
                {channel.logo && (
                  <Image
                    src={channel.logo}
                    alt=""
                    width={40}
                    height={20}
                    className="mx-auto h-5 w-10 object-contain opacity-90"
                    unoptimized
                  />
                )}
                <p className="mt-5 font-display text-3xl font-semibold tracking-tight">
                  {channel.name}
                </p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">
                  {channel.family}
                </p>
              </div>
            </div>
            <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 backdrop-blur-sm">
              <span className="size-1.5 animate-[pulse-live_1.9s_ease-in-out_infinite] rounded-full bg-live" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff8b93]">
                Live
              </span>
            </div>
          </div>
          <div
            aria-hidden
            className="absolute inset-x-6 -bottom-8 h-16 rounded-[50%] blur-2xl"
            style={{ background: palette.glow }}
          />
        </div>
      </div>
    </section>
  );
}
