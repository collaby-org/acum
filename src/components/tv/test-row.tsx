"use client";

import { useEffect, useState, useRef } from "react";
import { Play, MonitorPlay } from "lucide-react";

interface TestChannel {
  id: string;
  name: string;
  logoHd: string | null;
  status?: string;
  category: string;
}

interface RowProps {
  title: string;
  channels: TestChannel[];
  onSelect: (channel: TestChannel) => void;
  onPlay?: (channel: TestChannel) => void;
}

export function TestRow({ title, channels, onSelect, onPlay }: RowProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const FOCUSED_CARD = "ring-2 ring-red-600 ring-offset-2 ring-offset-black scale-[1.32] z-20 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]";

  return (
    <section className="mb-12">
      <header className="mb-6 flex items-center justify-between px-6">
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      </header>
      <div className="px-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory flex gap-4 pb-4">
        {channels.map((c, i) => {
          const focused = focusedIndex === i;
          return (
            <button
              key={c.id}
              type="button"
              tabIndex={-1}
              onClick={() => { setFocusedIndex(i); }}
              className={`group relative flex-shrink-0 snap-start w-[300px] md:w-[340px] transition-all duration-300 ${focused ? FOCUSED_CARD : ""}`}
              style={{ transformOrigin: "center center" }}
            >
              <div className="relative aspect-video rounded-4 overflow-hidden bg-white/5">
                {c.logoHd ? (
                  <img src={c.logoHd} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
                    <MonitorPlay className="size-12 text-white/30" />
                  </div>
                )}
              </div>
              <div className="mt-3 px-1">
                <h3 className="font-display text-base font-bold text-white line-clamp-1 group-hover:text-red-600 transition">{c.name}</h3>
                <p className="text-xs text-white/50 truncate">{c.category}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}