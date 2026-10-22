"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { VideoPlayer } from "@/components/player/video-player";
import type { Channel } from "@/data/types";

export function TVDirectory({ channels }: { channels: Array<{
  id: string; name: string; status: string; quality: string;
  logo: string | null; logoHd: string | null; now: string | null; viewers: number;
}> }) {
  const [selected, setSelected] = useState<string>(channels[0]?.id ?? "");
  const sel = channels.find((c) => c.id === selected) ?? channels[0];

  return (
    <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12 py-6">
      {/* Sticky player — stays fixed when scrolling */}
      <div className="sticky top-0 z-30 h-[55vh] rounded-2xl overflow-hidden border border-white/10 bg-black mb-6">
        {sel ? (
          <VideoPlayer channelName={sel.name} channelId={sel.id} autoPlay className="rounded-none border-0 h-full" />
        ) : null}
      </div>

      {/* Grid — big cards for remote D-pad */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {channels.map((ch) => (
          <Link
            key={ch.id}
            href={`/canal/${ch.id}`}
            onClick={() => setSelected(ch.id)}
            className={`relative flex flex-col rounded-2xl border p-5 transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal ${
              selected === ch.id ? "border-signal/60 bg-surface/70 shadow-[0_12px_30px_-10px_rgba(242,167,27,0.3)] scale-[1.02]" : "border-white/[0.08] bg-surface/40 hover:border-white/20"
            }`}
          >
            <div className="h-20 w-full overflow-hidden rounded-xl bg-white/[0.06] flex items-center justify-center">
              <img src={ch.logoHd ?? ch.logo ?? ""} alt={ch.name} className="h-full w-full object-contain p-2 opacity-95" loading="lazy" />
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold tracking-tight truncate">{ch.name}</h3>
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-faint">
              <span className={ch.status === "live" ? "text-live font-medium" : ""}>{ch.status === "live" ? "LIVE" : ch.status}</span>
              <span>·</span>
              <span>{ch.quality}</span>
            </div>
            <p className="mt-1 text-[11px] text-ink-faint">{ch.now ?? "—"}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
