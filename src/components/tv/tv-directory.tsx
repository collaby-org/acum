"use client";

/**
 * The TV browse directory — one grid of every channel, designed for a smart TV
 * remote (D-pad navigation) rather than a mouse or touch.
 *
 * Rules from the spec:
 * - Full-page dark (`bg-[#0a0a0c]`)
 * - Big grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`)
 * - Each card = logo + name + current show + status badge + live viewers
 * - `min-h-[140px]`, `rounded-2xl`, `border-white/10`
 * - Large visible focus ring: `focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal`
 * - All states visible; no hover-only interaction
 */

import { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import { VideoPlayer } from "@/components/player/video-player";
import { TVPlayer } from "./tv-player";
import { STATUS_META } from "@/lib/channel-meta";
import { formatViewers } from "@/lib/utils";

export type TVDirectoryChannel = {
  id: string;
  name: string;
  family: string;
  familyKey: string;
  category: string;
  logo: string | null;
  logoHd: string | null;
  logoDark: boolean;
  status: string;
  quality: string;
  now: string | null;
  until: string | null;
  viewers: number;
};

export type TVDirectoryCategory = {
  id: string;
  label: string;
};

export type TVDirectoryProps = {
  channels: TVDirectoryChannel[];
  categories?: TVDirectoryCategory[];
  liveCount?: number;
};

export function TVDirectory({ channels, liveCount = 0 }: TVDirectoryProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [installable, setInstallable] = useState(false);
  const openChannel = channels.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    const onBack = (e: KeyboardEvent) => {
      if (e.key === "Back" || (e.key === "Escape" && !e.shiftKey)) setOpenId(null);
    };
    window.addEventListener("keydown", onBack);
    window.addEventListener("beforeinstallprompt", (e: Event) => { (e as Event & { preventDefault: () => void }).preventDefault(); setInstallable(true); });
    return () => { window.removeEventListener("keydown", onBack); window.removeEventListener("beforeinstallprompt", () => {}); };
  }, []);

  return (
    <div className="min-h-dvh bg-[#0a0a0c] text-white">
      {/* Sticky player — visible while grid scrolls below */}
      {openChannel ? (
        <TVPlayer
          channelName={openChannel.name}
          channelId={openChannel.id}
          autoPlay
        />
      ) : (
        <div className="sticky top-0 z-30 h-[55vh] border-b border-white/10 bg-black" aria-label="Zona de redare" />
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-12">
        {/* Header */}
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Toate canalele
          </h1>
          <p className="mt-3 text-base text-white/60 sm:text-lg">
            {channels.length} canale · {liveCount} live acum · în ordine alfabetă
          </p>
        </header>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">
          {channels.map((channel) => {
            const meta = STATUS_META[channel.status as keyof typeof STATUS_META] ?? STATUS_META.live;
            const isOpen = openId === channel.id;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => setOpenId(isOpen ? null : channel.id)}
                aria-pressed={isOpen}
                aria-label={`${channel.name} — ${channel.now ?? "fără program"}`}
                className={
                  "relative flex min-h-[140px] flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition-colors duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal " +
                  (isOpen ? "border-signal/60 bg-signal/10" : "hover:border-white/20 hover:bg-white/[0.06]")
                }
              >
                {/* Status badge */}
                <span
                  className={
                    "absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-none " +
                    (meta.tone === "live" ? "bg-emerald-600/90 text-white" : meta.tone === "warn" ? "bg-amber-600/90 text-white" : "bg-white/10 text-white/70")
                  }
                >
                  <span
                    className={
                      "inline-block size-1.5 rounded-full " +
                      (meta.tone === "live" ? "bg-emerald-300" : meta.tone === "warn" ? "bg-amber-300" : "bg-white/40")
                    }
                  />
                  {meta.label}
                </span>

                {/* Logo */}
                <div className="mb-3 h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-white/[0.04]">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={`${channel.name} logo`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/40">
                      {channel.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Name */}
                <h2 className="text-base font-bold leading-snug text-white">{channel.name}</h2>

                {/* Current show */}
                <p className="mt-1 text-sm leading-relaxed text-white/70">
                  {channel.now ? channel.now : <span className="text-white/30">—</span>}
                </p>
                {channel.until && (
                  <p className="mt-0.5 text-xs text-white/40">până la {channel.until}</p>
                )}

                {/* Live viewers */}
                <div className="mt-auto flex items-center gap-1.5 pt-3 text-xs font-medium text-white/60">
                  <Eye className="size-3.5" aria-hidden />
                  <span>{formatViewers(channel.viewers)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
