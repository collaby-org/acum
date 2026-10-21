"use client";

import { useId, useState } from "react";
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PlayerControlsProps = {
  /** True while frames are on screen. */
  playing: boolean;
  muted: boolean;
  volume: number;
  /** True while the player is looking for a working link. */
  busy?: boolean;
  /** True while the picture fills the screen. */
  fullscreen?: boolean;
  /** Name of the feed currently in use, e.g. "S1". */
  sourceLabel?: string;
  /** Shown only when another link is available. */
  canSwitch?: boolean;
  /** True when the browser can put the picture in a floating window. */
  canPictureInPicture?: boolean;
  /** The window of the live stream the viewer may move through. */
  liveWindow?: { from: number; to: number; current: number } | null;
  /** True while the viewer sits behind the live edge. */
  behindLive?: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  onToggleFullscreen: () => void;
  onTogglePictureInPicture?: () => void;
  onSeek?: (time: number) => void;
  onJumpToLive?: () => void;
  onRetry: () => void;
  onNextSource?: () => void;
  className?: string;
};

/**
 * The transport bar under the picture.
 *
 * Every control is a real button with a label; the toggles carry
 * `aria-pressed` so a screen reader can tell their state. The scrubber only
 * spans what the stream has buffered — a live channel has no past to scrub
 * into.
 */
export function PlayerControls({
  playing,
  muted,
  volume,
  busy = false,
  fullscreen = false,
  sourceLabel,
  canSwitch = false,
  canPictureInPicture = false,
  liveWindow = null,
  behindLive = false,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
  onTogglePictureInPicture,
  onSeek,
  onJumpToLive,
  onRetry,
  onNextSource,
  className,
}: PlayerControlsProps) {
  const volumeId = useId();
  const scrubId = useId();
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const span = liveWindow ? liveWindow.to - liveWindow.from : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-white/8 bg-canvas-raised px-3 py-2.5 sm:px-4",
        className,
      )}
    >
      <Button
        variant="primary"
        size="icon"
        onClick={onTogglePlay}
        aria-label={playing ? "Pauză" : "Redare"}
        title={playing ? "Pauză" : "Redare"}
      >
        {playing ? <Pause className="size-4.5" /> : <Play className="size-4.5" />}
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggleMute}
        aria-label={muted ? "Ssună audio" : "Dezactivează sunetul"}
        aria-pressed={muted}
        title={muted ? "Ssună audio" : "Dezactivează sunetul"}
      >
        {muted ? (
          <VolumeX className="size-4" />
        ) : (
          <Volume2 className="size-4" />
        )}
      </Button>

      <label htmlFor={volumeId} className="sr-only">
        Volum
      </label>
      <input
        id={volumeId}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={(event) => onVolumeChange(Number(event.target.value))}
        className="hidden h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/15 accent-signal sm:block"
        aria-label="Volum"
      />

      {liveWindow && span > 1 ? (
        <>
          <label htmlFor={scrubId} className="sr-only">
            Poziția în flux
          </label>
          <input
            id={scrubId}
            type="range"
            min={liveWindow.from}
            max={liveWindow.to}
            step={0.5}
            value={scrubbing ? scrubValue : liveWindow.current}
            onChange={(event) => setScrubValue(Number(event.target.value))}
            onPointerDown={() => {
              setScrubValue(liveWindow.current);
              setScrubbing(true);
            }}
            onPointerUp={() => {
              setScrubbing(false);
              onSeek?.(scrubValue);
            }}
            onKeyUp={() => {
              setScrubbing(false);
              onSeek?.(scrubValue);
            }}
            className="hidden h-1 w-28 cursor-pointer appearance-none rounded-full bg-white/15 accent-signal md:block"
            aria-label="Poziția în flux"
          />
        </>
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRetry}
        aria-label="Reîncearcă fluxul"
        title="Reîncearcă fluxul"
      >
        <RotateCcw className={cn("size-4", busy && "animate-spin")} />
      </Button>

      {canSwitch && onNextSource ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onNextSource}
          aria-label="Treci la următorul flux"
        >
          <SkipForward className="size-4" />
          <span className="hidden sm:inline">Alt flux</span>
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        {behindLive && onJumpToLive ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onJumpToLive}
            aria-label="Înapoi la direct"
          >
            <Radio className="size-3.5 text-live" />
            Înapoi la direct
          </Button>
        ) : null}

        {sourceLabel ? (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
            <span
              aria-hidden
              className="relative size-1.5 animate-[pulse-live_1.9s_ease-in-out_infinite] rounded-full bg-live"
            />
            {sourceLabel}
          </span>
        ) : null}

        {canPictureInPicture && onTogglePictureInPicture ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onTogglePictureInPicture}
            aria-label="Picture in Picture"
            title="Picture in Picture"
          >
            <PictureInPicture2 className="size-4" />
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? "Ieși din ecran complet" : "Ecran complet"}
          aria-pressed={fullscreen}
          title={fullscreen ? "Ieși din ecran complet" : "Ecran complet"}
        >
          {fullscreen ? (
            <Minimize className="size-4" />
          ) : (
            <Maximize className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
