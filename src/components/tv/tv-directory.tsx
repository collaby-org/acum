"use client";

/**
 * Netflix-style TV experience, remote-first:
 * - Catalog grid is the start page (like the Netflix app home).
 * - Selecting a channel opens the channel view: live preview + „Redă”.
 * - „Redă” goes true full screen, Netflix style.
 * - Back exits full screen → channel view → catalog.
 * - Cursor is hidden everywhere inside /tv — remote only, no pointer.
 */

import { useEffect, useState } from "react";
import { ArrowLeft, MonitorPlay, Play } from "lucide-react";
import { VideoPlayer } from "@/components/player/video-player";
import { TVPlayerFullscreen, type TVChannel } from "./tv-player-fullscreen";

export type TVDirectoryChannel = {
  id: string;
  name: string;
  family: string;
  familyKey: string;
  category: string;
  logo: string | null;
  logoHd: string | null;
  status?: string;
};

export type TVDirectoryProps = {
  channels: TVDirectoryChannel[];
  liveCount?: number;
};

const NO_CURSOR = `.tv-root, .tv-root * { cursor: none !important; }`;

export function TVDirectory({ channels, liveCount = 0 }: TVDirectoryProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const openChannel = channels.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    const onBack = (e: KeyboardEvent) => {
      if (e.key === "Back" || (e.key === "Escape" && !e.shiftKey)) {
        if (full) setFull(false);
        else if (openId) setOpenId(null);
      }
    };
    window.addEventListener("keydown", onBack);
    return () => window.removeEventListener("keydown", onBack);
  }, [full, openId]);

  /* Full screen — video fills the viewport, nothing else (Netflix play mode) */
  if (openChannel && full) {
    return (
      <div className="tv-root min-h-dvh bg-black">
        <style>{NO_CURSOR}</style>
        <TVPlayerFullscreen
          channel={openChannel as unknown as TVChannel}
          onBack={() => setFull(false)}
        />
      </div>
    );
  }

  /* Channel view — preview plays now, „Redă” goes full screen */
  if (openChannel) {
    return (
      <div className="tv-root min-h-dvh bg-[#0a0a0c] text-white">
        <style>{NO_CURSOR}</style>
        <main className="mx-auto max-w-5xl px-6 py-8 lg:px-12">
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-5 text-sm font-medium text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal hover:bg-white/[0.12]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Înapoi la canale
          </button>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
            <VideoPlayer
              channelName={openChannel.name}
              channelId={openChannel.id}
              autoPlay
              className="aspect-video w-full"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {openChannel.name}
              </h1>
              <p className="mt-1 text-sm text-white/50">
                <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                  <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
                  LIVE
                </span>
                {openChannel.category}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFull(true)}
              className="inline-flex h-14 items-center gap-3 rounded-full bg-signal px-8 text-lg font-bold text-[#141005] shadow-[0_10px_40px_-10px_rgba(242,167,27,0.7)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0a0c] hover:bg-signal-bright"
            >
              <Play className="size-6" aria-hidden />
              Redă
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* Catalog — the start page, built like the Netflix app home */
  const featured = channels.find((c) => c.status === "live") ?? null;

  return (
    <div className="tv-root min-h-dvh bg-[#0a0a0c] text-white">
      <style>{NO_CURSOR}</style>
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-12">
        {featured && (
          <section className="mb-10">
            <button
              type="button"
              onClick={() => setOpenId(featured.id)}
              className="group relative block w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-8 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:p-10"
            >
              <div className="flex flex-wrap items-center gap-6">
                <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg sm:size-24">
                  {featured.logoHd ? (
                    <img src={featured.logoHd} alt="" className="max-h-14 max-w-24 object-contain sm:max-h-16" />
                  ) : (
                    <MonitorPlay className="size-8 text-white/50" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-signal">Acum la TV</p>
                  <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-5xl">{featured.name}</h2>
                  <p className="mt-2 text-sm text-white/50">{liveCount} canale live · apasă pentru previzualizare</p>
                </div>
                <span className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-black transition group-hover:bg-signal">
                  <Play className="size-5" aria-hidden />
                  Redă
                </span>
              </div>
            </button>
          </section>
        )}

        <header className="mb-6 flex items-end justify-between">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Toate canalele</h1>
          <p className="text-sm text-white/40">{liveCount} live</p>
        </header>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c] hover:bg-white/[0.07]"
            >
              <div className="grid size-14 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black shadow-md">
                {c.logoHd ? (
                  <img src={c.logoHd} alt={c.name} className="max-h-10 max-w-[72px] object-contain" loading="lazy" />
                ) : (
                  <span className="text-xs font-bold text-white/70">{c.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <h3 className="font-display text-base font-semibold leading-snug">{c.name}</h3>
                <span className="text-xs text-white/40">{c.status === "live" ? "Live" : c.status}</span>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
