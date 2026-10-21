"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Heart,
  LayoutGrid,
  Play,
  Radio,
  ShieldCheck,
  Signal,
} from "lucide-react";
import type { Channel } from "@/data/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const h = palette.hue;
  const clock = useClock();

  return (
    <section className="relative isolate overflow-hidden pb-16 pt-24 sm:pb-20 sm:pt-28 lg:pb-24 lg:pt-32">
      {/* ---------------------------------------------------------- *
       * Ambient light field — the room the hero sits in.
       * ---------------------------------------------------------- */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0b0e19_0%,#06080f_46%,#04050c_100%)]" />

        {/* Light, screen-blended so it stays luminous instead of muddy.
            On narrow screens the screen sits under the copy, so the warm
            light moves down with it. */}
        <div
          className="absolute inset-0 mix-blend-screen lg:hidden"
          style={{
            background: [
              `radial-gradient(96% 40% at 50% 94%, hsl(${h} 92% 56% / 0.52) 0%, transparent 66%)`,
              `radial-gradient(74% 34% at 22% 2%, hsl(214 96% 64% / 0.34) 0%, transparent 70%)`,
            ].join(", "),
          }}
        />
        <div
          className="absolute inset-0 hidden mix-blend-screen lg:block"
          style={{
            background: [
              `radial-gradient(68% 56% at 74% 4%, hsl(${h} 92% 56% / 0.55) 0%, transparent 62%)`,
              `radial-gradient(44% 42% at 2% 24%, hsl(214 96% 64% / 0.4) 0%, transparent 70%)`,
              `radial-gradient(56% 40% at 22% 98%, hsl(${h} 88% 52% / 0.34) 0%, transparent 66%)`,
            ].join(", "),
          }}
        />

        {/* A hard light source behind the screen, so the glass has an origin. */}
        <div
          className="absolute -right-[6%] top-[2%] hidden h-[520px] w-[520px] animate-drift rounded-full opacity-60 blur-[90px] mix-blend-screen lg:block"
          style={{
            background: `radial-gradient(circle at 50% 50%, hsl(${h} 95% 62% / 0.5) 0%, transparent 66%)`,
          }}
        />

        <div className="fx-grain absolute inset-0 opacity-[0.09] mix-blend-overlay" />
        <div className="fx-scanline absolute inset-0 opacity-50 mix-blend-soft-light" />
        <div className="fx-vignette absolute inset-0 opacity-35" />
      </div>

      {/* The hero hands the page over to the rails below it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-t from-canvas via-canvas/85 to-transparent"
      />

      <div className="relative z-10 mx-auto grid max-w-[1800px] grid-cols-1 items-center gap-12 px-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-16 lg:px-12">
        {/* -------------------------------------------------------- *
         * Copy — staged entrance, each beat on its own curve.
         * -------------------------------------------------------- */}
        <div className="min-w-0 max-w-2xl">
          <div
            className="animate-rise flex flex-wrap items-center gap-2.5"
            style={{ animationDelay: "40ms" }}
          >
            <Badge variant="live" size="sm">
              <span className="size-1.5 animate-pulse-live rounded-full bg-live" />
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

          <h1
            className="animate-rise mt-5 font-display text-[clamp(2.5rem,6.6vw,5rem)] font-bold leading-[0.92] tracking-[-0.035em] text-balance"
            style={{ animationDelay: "120ms" }}
          >
            <span className="bg-gradient-to-b from-white to-white/[0.78] bg-clip-text text-transparent">
              {channel.name}
            </span>
          </h1>

          <p
            className="animate-rise mt-5 max-w-xl text-[15px] leading-relaxed text-ink-muted sm:text-base"
            style={{ animationDelay: "220ms" }}
          >
            {channel.family} — unul dintre cele{" "}
            <span className="font-semibold text-ink">{totalCount}</span> canale
            adunate în VIZOR. Fără cont, fără reclame, fără pauze: doar canalul
            și un player care pornește imediat.
          </p>

          {/* Actions */}
          <div
            className="animate-rise mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "320ms" }}
          >
            <span className="group relative inline-flex">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 scale-90 rounded-full bg-signal/45 opacity-0 blur-2xl transition-all duration-500 ease-out group-hover:scale-110 group-hover:opacity-100"
              />
              <Button
                size="lg"
                onClick={() => onPlay(channel)}
                className={cn(
                  "relative isolate overflow-hidden rounded-full bg-signal text-signal-ink",
                  "shadow-[0_18px_46px_-16px_rgba(242,167,27,0.9)]",
                  "transition-[transform,box-shadow,background-color] duration-300 ease-spring",
                  "hover:-translate-y-0.5 hover:bg-signal-bright hover:shadow-[0_28px_62px_-18px_rgba(242,167,27,0.95)]",
                  "active:translate-y-0 active:scale-[0.975]",
                )}
              >
                <Play className="size-4.5 translate-x-[1px] fill-current" />
                Vizionează acum
              </Button>
            </span>

            <span className="group relative inline-flex">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 scale-90 rounded-full bg-white/20 opacity-0 blur-2xl transition-all duration-500 ease-out group-hover:scale-110 group-hover:opacity-100"
              />
              <Button
                size="lg"
                variant="secondary"
                onClick={() => onToggleFavorite(channel)}
                aria-pressed={isFavorite}
                className={cn(
                  "relative isolate overflow-hidden rounded-full border-white/12 bg-white/[0.06] text-ink backdrop-blur-xl",
                  "transition-[transform,box-shadow,background-color,color,border-color] duration-300 ease-spring",
                  "hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.12]",
                  "active:translate-y-0 active:scale-[0.975]",
                  isFavorite &&
                    "border-signal/45 bg-signal/12 text-signal-bright shadow-[0_18px_46px_-18px_rgba(242,167,27,0.6)]",
                )}
              >
                <Heart
                  className={cn(
                    "size-4.5 transition-transform duration-500 ease-spring",
                    isFavorite && "scale-110 fill-current",
                  )}
                />
                {isFavorite ? "Salvat" : "Adaugă la favorite"}
              </Button>
            </span>

            <Button
              size="lg"
              variant="ghost"
              onClick={onBrowse}
              className={cn(
                "rounded-full text-ink-muted",
                "transition-[transform,color,background-color] duration-300 ease-spring",
                "hover:-translate-y-0.5 hover:text-ink",
              )}
            >
              <Radio className="size-4.5" />
              {liveCount} canale active
            </Button>
          </div>

          {/* Facts */}
          <dl
            className="animate-rise mt-9 grid max-w-lg grid-cols-3 gap-2.5"
            style={{ animationDelay: "420ms" }}
          >
            <Fact icon={Radio} value={String(liveCount)} label="în direct" />
            <Fact icon={LayoutGrid} value={String(totalCount)} label="canale" />
            <Fact icon={ShieldCheck} value="0" label="reclame" />
          </dl>
        </div>

        {/* -------------------------------------------------------- *
         * The screen — a panel of glass with the channel on it.
         * -------------------------------------------------------- */}
        <div className="relative mx-auto w-full min-w-0 max-w-[600px] lg:max-w-none">
          {/* The light the panel throws into the room. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-2 -top-6 bottom-2 -z-10 blur-[70px]"
            style={{
              background: `radial-gradient(52% 52% at 58% 46%, hsl(${h} 92% 58% / 0.55) 0%, transparent 72%)`,
            }}
          />

          <div className="fx-sweep relative isolate aspect-video w-full overflow-hidden rounded-[24px] shadow-[0_60px_120px_-40px_rgba(0,0,0,0.95)] sm:rounded-[28px]">
            {/* On-air colour */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: [
                  `radial-gradient(110% 104% at 12% -14%, hsl(${h} 88% 52% / 0.95) 0%, transparent 54%)`,
                  `radial-gradient(86% 86% at 106% 108%, hsl(${(h + 290) % 360} 82% 48% / 0.62) 0%, transparent 62%)`,
                  `radial-gradient(64% 62% at 26% 118%, hsl(${(h + 186) % 360} 78% 44% / 0.4) 0%, transparent 66%)`,
                  `linear-gradient(158deg, hsl(${h} 66% 12%) 0%, hsl(${(h + 322) % 360} 58% 6%) 100%)`,
                ].join(", "),
              }}
            />

            {/* The key light raking across the glass. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(46% 52% at 4% 0%, rgba(255,255,255,0.22) 0%, transparent 66%)",
              }}
            />

            <div
              aria-hidden
              className="fx-scanline absolute inset-0 opacity-70 mix-blend-overlay"
            />
            <div
              aria-hidden
              className="fx-grain absolute inset-0 opacity-[0.14] mix-blend-overlay"
            />
            <div aria-hidden className="fx-vignette absolute inset-0 opacity-60" />

            {/* Glass boundary: a lit top edge and a hairline ring. */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),inset_0_0_0_1px_rgba(255,255,255,0.1)]"
            />
            {live && (
              <div
                aria-hidden
                className="absolute inset-0 rounded-[inherit] shadow-[inset_0_0_100px_rgba(255,59,71,0.09)]"
              />
            )}

            {/* Top bar: live lens on the left, the wall clock on the right. */}
            <div className="absolute inset-x-4 top-4 z-[2] flex items-start justify-between">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/45 px-2.5 py-1.5 backdrop-blur-xl">
                <span className="relative grid size-2 place-items-center">
                  <span aria-hidden className="fx-live-eye absolute inset-0" />
                  <span
                    aria-hidden
                    className="relative size-2 rounded-full bg-live"
                  />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-live-soft">
                  Live
                </span>
              </span>

              <span className="rounded-full border border-white/12 bg-black/45 px-2.5 py-1.5 font-mono text-[11px] tabular-nums tracking-wider text-white/75 backdrop-blur-xl">
                {clock}
              </span>
            </div>

            {/* Brand mark */}
            <div className="absolute inset-0 z-[2] grid place-items-center p-8 text-center">
              <div>
                {channel.logo && (
                  <div className="mx-auto w-fit rounded-2xl border border-white/[0.14] bg-black/55 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_28px_60px_-26px_rgba(0,0,0,0.95)] backdrop-blur-xl">
                    <Image
                      src={channel.logo}
                      alt=""
                      width={40}
                      height={20}
                      className="h-10 w-20 rounded-[6px] object-cover opacity-95"
                      unoptimized
                    />
                  </div>
                )}
                <h2 className="mt-6 font-display text-[clamp(1.5rem,3.2vw,2.35rem)] font-bold leading-tight tracking-[-0.025em] text-white drop-shadow-[0_6px_28px_rgba(0,0,0,0.85)]">
                  {channel.name}
                </h2>
                <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.24em] text-white/55">
                  {channel.family}
                </p>
              </div>
            </div>
          </div>

          {/* The panel bleeds light onto the surface below it. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-20 -bottom-5 h-14 rounded-[50%] opacity-70 blur-3xl"
            style={{ background: `hsl(${h} 92% 58% / 0.6)` }}
          />
        </div>
      </div>
    </section>
  );
}

function Fact({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Radio;
  value: string;
  label: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-3 backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-ink-faint">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p className="mt-1.5 font-display text-xl font-bold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

/**
 * A wall clock on the screen. It starts empty so the server and the client
 * render the same markup, then fills in once mounted.
 */
function useClock() {
  const [time, setTime] = useState("--:--");

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("ro-RO", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);

  return time;
}
