"use client";

import { useEffect, useState } from "react";
import { VideoPlayer } from "@/components/player/video-player";
import { ArrowLeft } from "lucide-react";

export type TVChannel = {
  id: string;
  name: string;
  status: string;
  quality: string;
  logo: string | null;
  logoHd: string | null;
};

export function TVPlayerFullscreen({ channel, onBack }: { channel: TVChannel; onBack: () => void }) {
  useEffect(() => {
    const onBackKey = (e: KeyboardEvent) => {
      if (e.key === "Back" || (e.key === "Escape" && !e.shiftKey)) onBack();
    };
    window.addEventListener("keydown", onBackKey);
    document.body.style.overflow = "hidden";
    document.body.style.cursor = "none";
    return () => {
      window.removeEventListener("keydown", onBackKey);
      document.body.style.overflow = "";
      document.body.style.cursor = "";
    };
  }, [onBack]);

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-black/70 to-transparent z-10">
        <button
          type="button"
          onClick={onBack}
          aria-label="Înapoi"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 text-[13px] font-medium text-ink backdrop-blur-md transition hover:bg-white/[0.14]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Înapoi
        </button>
        <h2 className="font-display text-xl font-bold tracking-tight truncate text-white">{channel.name}</h2>
      </div>
      <div className="flex-1 relative">
        <VideoPlayer
          channelName={channel.name}
          channelId={channel.id}
          autoPlay
          className="rounded-none border-0 h-full w-full"
        />
      </div>
    </div>
  );
}
