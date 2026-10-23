"use client";

import { useEffect, useState, useRef } from "react";
import { VideoPlayer, type PlayerHandle } from "@/components/player/video-player";
import { ArrowLeft, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Info, X, Maximize, Minimize, Settings, Subtitles, Mic2 } from "lucide-react";

export type TVChannel = {
  id: string;
  name: string;
  status: string;
  quality: string;
  logo: string | null;
  logoHd: string | null;
};

export function TVPlayerFullscreen({ channel, onBack }: { channel: TVChannel; onBack: () => void }) {
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<PlayerHandle>(null);

  useEffect(() => {
    const onBackKey = (e: KeyboardEvent) => {
      if (e.key === "Back" || (e.key === "Escape" && !e.shiftKey)) {
        if (showSettings) {
          setShowSettings(false);
        } else {
          onBack();
        }
      }
    };
    window.addEventListener("keydown", onBackKey);
    document.body.style.overflow = "hidden";
    document.body.style.cursor = "none";
    return () => {
      window.removeEventListener("keydown", onBackKey);
      document.body.style.overflow = "";
      document.body.style.cursor = "";
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, [onBack, showSettings]);

  // Auto-hide controls
  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 4000);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    showControlsTemporarily();
    if (showSettings) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
      }
      return;
    }

    const player = videoRef.current;
    switch (e.key) {
      case " ":
      case "Enter":
      case "k":
        e.preventDefault();
        if (player) {
          if (playing) player.pause();
          else player.play();
        }
        setPlaying((p) => !p);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (player) player.retry();
        break;
      case "ArrowRight":
        e.preventDefault();
        if (player) player.next();
        break;
      case "ArrowUp":
        e.preventDefault();
        setVolume((v) => Math.min(1, v + 0.1));
        break;
      case "ArrowDown":
        e.preventDefault();
        setVolume((v) => Math.max(0, v - 0.1));
        break;
      case "m":
        setMuted((m) => !m);
        break;
      case "i":
        setShowSettings((s) => !s);
        break;
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSettings]);

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col">
      <style>{`.tv-root, .tv-root * { cursor: none !important; }`}</style>

      {/* Top bar */}
      <div className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-black/70 to-transparent z-10 transition-opacity duration-300 ${showControls || showSettings ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Înapoi"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 text-[13px] font-medium text-white backdrop-blur-md transition hover:bg-white/[0.14]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Înapoi</span>
        </button>
        <h2 className="font-display text-xl font-bold tracking-tight truncate text-white flex-1">{channel.name}</h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
            <span className="size-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
            LIVE
          </span>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-xl border border-white/12 bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white transition"
            aria-label="Setări"
          >
            <Settings className="size-5" />
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative" onMouseMove={showControlsTemporarily} onMouseEnter={showControlsTemporarily}>
        <VideoPlayer
          ref={videoRef}
          channelName={channel.name}
          channelId={channel.id}
          autoPlay
          className="rounded-none border-0 h-full w-full"
        />

        {/* Bottom controls */}
        <div className={`absolute bottom-0 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <div className="max-w-6xl mx-auto">
            {/* Progress bar */}
            <div className="mb-4">
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer" role="slider" aria-label="Progres">
                <div className="absolute top-0 left-0 h-full bg-signal rounded-full transition-all duration-100" style={{ width: "0%" }} />
              </div>
              <div className="flex justify-between text-[11px] text-white/50 mt-1">
                <span>0:00</span>
                <span>LIVE</span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                className="p-3 rounded-full border border-white/12 bg-white/[0.08] text-white/90 hover:bg-white/[0.16] transition"
                aria-label="Reîncepe de la început"
              >
                <SkipBack className="size-6" />
              </button>
              <button
                type="button"
                className="p-4 rounded-full bg-signal text-[#141005] hover:bg-signal-bright transition shadow-[0_8px_30px_-10px_rgba(242,167,27,0.7)]"
                aria-label={playing ? "Pauză" : "Redă"}
              >
                {playing ? <Pause className="size-8" /> : <Play className="size-8" />}
              </button>
              <button
                type="button"
                className="p-3 rounded-full border border-white/12 bg-white/[0.08] text-white/90 hover:bg-white/[0.16] transition"
                aria-label="Sari 30s"
              >
                <SkipForward className="size-6" />
              </button>

              <div className="mx-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMuted(!muted)}
                  className="p-3 rounded-full border border-white/12 bg-white/[0.08] text-white/70 hover:bg-white/[0.16] transition"
                  aria-label={muted ? "Activează sunetul" : "Mute"}
                >
                  {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                </button>
                <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-white/70 rounded-full transition-all duration-100" style={{ width: muted ? "0%" : `${volume * 100}%` }} />
                </div>
              </div>

              <button
                type="button"
                className="p-3 rounded-full border border-white/12 bg-white/[0.08] text-white/70 hover:bg-white/[0.16] transition"
                aria-label="Subtitrari"
              >
                <Subtitles className="size-5" />
              </button>
              <button
                type="button"
                className="p-3 rounded-full border border-white/12 bg-white/[0.08] text-white/70 hover:bg-white/[0.16] transition"
                aria-label="Audio"
              >
                <Mic2 className="size-5" />
              </button>
              <button
                type="button"
                className="p-3 rounded-full border border-white/12 bg-white/[0.08] text-white/70 hover:bg-white/[0.16] transition"
                aria-label="Calitate video"
              >
                <Maximize className="size-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Info overlay - top left */}
        <div className={`absolute top-16 left-4 flex flex-col gap-2 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <div className="flex items-center gap-2 rounded-xl bg-black/80 backdrop-blur-md px-4 py-2 text-white text-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
              LIVE
            </span>
            <span className="text-white/70">{channel.name}</span>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="absolute top-0 right-0 bottom-0 w-80 bg-black/95 backdrop-blur-xl border-l border-white/10 z-20 flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-lg font-bold">Setări player</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 rounded-xl hover:bg-white/[0.08] transition">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wide">Calitate video</h4>
                <div className="space-y-2">
                  {["Auto", "1080p", "720p", "480p"].map((q) => (
                    <button key={q} className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] transition">
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wide">Subtitrări</h4>
                <div className="space-y-2">
                  <button className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] transition">Dezactivate</button>
                  <button className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] transition">Română</button>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wide">Pistă audio</h4>
                <div className="space-y-2">
                  <button className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] transition">Română (Stereo)</button>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wide">Viteză redare</h4>
                <div className="flex gap-2 flex-wrap">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button key={s} className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] transition">
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings backdrop */}
        {showSettings && (
          <div
            className="absolute inset-0 bg-black/50 z-10"
            onClick={() => setShowSettings(false)}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}