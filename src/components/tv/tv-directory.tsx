"use client";

import { useState, useEffect } from "react";
import { Eye, Play } from "lucide-react";
import { TVPlayerFullscreen, type TVChannel } from "./tv-player-fullscreen";
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
};

export type TVDirectoryProps = {
  channels: TVDirectoryChannel[];
  liveCount?: number;
};

export function TVDirectory({ channels, liveCount = 0 }: TVDirectoryProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openChannel = channels.find((c) => c.id === openId);

  useEffect(() => {
    const onBack = (e: KeyboardEvent) => {
      if (e.key === "Back" || (e.key === "Escape" && !e.shiftKey)) setOpenId(null);
    };
    window.addEventListener("keydown", onBack);
    return () => window.removeEventListener("keydown", onBack);
  }, []);

  if (openChannel) {
    return (
      <div className="min-h-dvh bg-black">
        <TVPlayerFullscreen
          channel={openChannel as unknown as TVChannel}
          onBack={() => setOpenId(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0c] text-white select-none" style={{ cursor: "none" }}>
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-12">
        <header className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Toate canalele</h1>
            <p className="mt-2 text-base text-white/50">{liveCount} live · apasă pe card cu telecomanda</p>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className="group relative flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c] hover:bg-white/[0.07]"
            >
              <div className="grid size-14 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black shadow-md group-hover:shadow-lg transition">
                {c.logoHd ? (
                  <img src={c.logoHd} alt={c.name} className="max-h-10 max-w-[72px] object-contain" loading="lazy" />
                ) : (
                  <span className="text-xs font-bold text-white/70">{c.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <h3 className="font-display text-base font-semibold leading-snug">{c.name}</h3>
                <span className="text-xs text-white/40">Live</span>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
