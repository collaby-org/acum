"use client";

import { useId, useState, type ReactNode } from "react";
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * The live chrome
 *
 * A live channel says three things about itself: that it is live, how
 * much buffer the connection has put ahead of the playhead, and what
 * rung of the picture is on screen. Every player in the industry puts
 * all three in the transport bar — the badge on the left of the track,
 * the track filling the bar, the quality chip on the right of it — and
 * none of them over the picture, where they sit on top of the very
 * frame they describe and recede every time the picture is late.
 *
 * So the chrome lives here, in the bar, and the picture is left to the
 * picture: the loading spinner and the failure states are the only
 * things drawn over the frame now.
 * ------------------------------------------------------------------ */

/** The window of the live stream the viewer may move through. */
export type LiveWindow = {
  /** Where the buffered window starts, in stream seconds. */
  from: number;
  /** Where the buffer ends — the live edge, in stream seconds. */
  to: number;
  /** Where the playhead sits, in stream seconds. */
  current: number;
};

/**
 * The forward buffer the player asks hls.js to hold — `maxBufferLength`,
 * in the instance's own config. The live bar is measured against it: a
 * healthy live stream has this much in hand ahead of the playhead.
 */
const LIVE_BUFFER_TARGET = 30;

/**
 * How full the live bar reads, 0..1.
 *
 * A live edge has no end, so there is no duration to divide the playhead
 * by — `current/(to-from)` is a timestamp over a difference, and it
 * counts nothing. What the bar counts is the buffer: how much of the
 * window the stream has already put ahead of the playhead, against the
 * reach a healthy live buffer holds. The bar fills while the picture runs
 * at the edge, and it thins out while the buffer is starved — which is
 * the only thing a loading bar over a live picture can honestly say.
 */
export function liveFill(liveWindow: LiveWindow | null | undefined): number {
  if (!liveWindow) return 0;
  const ahead = liveWindow.to - liveWindow.current;
  if (!Number.isFinite(ahead) || ahead <= 0) return 0;
  return Math.min(1, ahead / LIVE_BUFFER_TARGET);
}

/**
 * The LIVE badge: the mark that says this is the live edge and not a
 * recording. A red lens with its halo, the word in the display face —
 * flat now, because it sits on the transport bar rather than on the
 * picture, and a glass pill floating over the frame says nothing here.
 */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      data-slot="live-badge"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-live/12 pl-1.5 pr-2",
        className,
      )}
    >
      <span className="relative grid size-2 place-items-center">
        <span aria-hidden className="fx-live-eye fx-live-eye-pulse absolute inset-0" />
        <span aria-hidden className="relative size-2 rounded-full bg-live" />
      </span>
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-live-soft">
        Live
      </span>
    </span>
  );
}

export type LiveBarProps = {
  /** How full the bar reads, 0..1. */
  fill: number;
  /** The window the playhead may be moved through. */
  liveWindow?: LiveWindow | null;
  /** Moves the playhead through the window — desktop only. */
  onSeek?: (time: number) => void;
  className?: string;
};

/**
 * The live bar.
 *
 * The track is the buffer, drawn from what the stream has put ahead of
 * the playhead. The range input over it is the DVR scrubber, and it only
 * appears where there is a pointer to drive it: a phone gets the filled
 * track and the LIVE badge, and nothing to drag.
 */
function LiveBar({
  fill,
  liveWindow = null,
  onSeek,
  className,
}: LiveBarProps) {
  const scrubId = useId();
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const span = liveWindow ? liveWindow.to - liveWindow.from : 0;
  const scrubbable = Boolean(liveWindow && onSeek && span > 1);
  const width = Math.max(0, Math.min(1, fill)) * 100;

  return (
    <div className={cn("flex min-w-0 flex-1 items-center", className)}>
      <div className="relative h-1.5 w-full rounded-full bg-white/15">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-signal",
            "shadow-[0_0_14px_rgb(242_167_27/0.5)] transition-[width] duration-500 ease-out",
          )}
          style={{ width: `${width}%` }}
        />

        {liveWindow && scrubbable ? (
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
              aria-label="Poziția în flux"
              className={cn(
                "pointer-events-auto absolute inset-0 hidden h-full w-full cursor-pointer appearance-none bg-transparent md:block",
                // `appearance-none` takes the native thumb away, so it is
                // drawn here — in both engines.
                "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink",
                "[&::-moz-range-track]:bg-transparent",
                "[&::-webkit-slider-runnable-track]:bg-transparent",
                "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink",
              )}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The jump back to the edge, offered by the live mark itself.
 *
 * The viewer sits behind the live edge, and one press walks them home.
 * It carries the same red lens as the badge — the eye reads it as the
 * same mark — but it is a button, so it is set as type rather than as
 * another pill: two red chips side by side say the same thing twice. On
 * a phone the words shorten to the destination, and the lens stays.
 */
function LiveJump({ onJump, className }: { onJump: () => void; className?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onJump}
      aria-label="Înapoi la direct"
      title="Înapoi la direct"
      className={cn(
        "h-6 shrink-0 gap-1.5 rounded-full px-2 text-live-soft",
        "hover:bg-live/12 hover:text-live",
        className,
      )}
    >
      <span className="relative grid size-2 place-items-center">
        <span aria-hidden className="fx-live-eye absolute inset-0" />
        <span aria-hidden className="relative size-2 rounded-full bg-live" />
      </span>
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.14em]">
        <span className="sm:hidden">Direct</span>
        <span className="hidden sm:inline">Înapoi la direct</span>
      </span>
    </Button>
  );
}

export type PlayerControlsProps = {
  /** True while frames are on screen. */
  playing: boolean;
  muted: boolean;
  volume: number;
  /** True while the player is looking for a working link. */
  busy?: boolean;
  /** True when the picture fills the screen: the bar floats over it. */
  fullscreen?: boolean;
  /** Fullscreen only: faded out and inert while the pointer rests. */
  asleep?: boolean;
  /** False when the browser cannot go full screen at all. */
  canFullscreen?: boolean;
  /** Shown only when another link is available. */
  canSwitch?: boolean;
  /** True when the browser can put the picture in a floating window. */
  canPictureInPicture?: boolean;
  /** True while the viewer sits behind the live edge. */
  behindLive?: boolean;
  /** What the stream has buffered, and where the live edge is right now. */
  liveWindow?: LiveWindow | null;
  /** Moves the playhead through the buffered window — desktop only. */
  onSeek?: (time: number) => void;
  /**
   * What is on now — the channel and the marks of the programme it is
   * playing. It heads the bar, the way every player names what it shows.
   */
  nowPlaying?: ReactNode;
  /** The quality badge, on the right of the track. */
  quality?: ReactNode;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  onToggleFullscreen: () => void;
  onTogglePictureInPicture?: () => void;
  onJumpToLive?: () => void;
  onRetry: () => void;
  onNextSource?: () => void;
  className?: string;
};

/**
 * The transport bar.
 *
 * Every control is a real button with a label; the toggles carry
 * `aria-pressed` so a screen reader can tell their state.
 *
 * The bar holds the live chrome as well: what is on now at its head, the
 * LIVE badge and the live bar under it, and the quality chip at the end of
 * the track. On a phone the chrome takes a row of its own above the
 * transport — a 360px screen cannot seat six controls and a scrubber side
 * by side, and squeezing them would leave the bar no room to say anything.
 * From `sm` up the two rows become one: the transport on the left, the
 * track filling what is left, the quality chip and the picture controls on
 * the right — the arrangement every player in the industry uses.
 */
export function PlayerControls({
  playing,
  muted,
  volume,
  busy = false,
  fullscreen = false,
  asleep = false,
  canFullscreen = true,
  canSwitch = false,
  canPictureInPicture = false,
  behindLive = false,
  liveWindow = null,
  onSeek,
  nowPlaying,
  quality,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
  onTogglePictureInPicture,
  onJumpToLive,
  onRetry,
  onNextSource,
  className,
}: PlayerControlsProps) {
  const volumeId = useId();

  return (
    <div
      className={cn(
        "flex flex-col",
        fullscreen
          ? // Fullscreen: the bar floats over the bottom of the picture on
             // a gradient, so the buttons stay readable over any frame.
             "absolute inset-x-0 bottom-0 z-30 border-t-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent pb-[max(1.25rem,env(safe-area-inset-bottom))] transition-opacity duration-300"
          : // The bar sits at the bottom of the sheet on a phone, clear of
             // the home indicator.
             "border-t border-white/8 bg-canvas-raised max-sm:pb-[max(0.625rem,env(safe-area-inset-bottom))]",
        // The picture runs alone in fullscreen until the pointer moves.
        asleep && "pointer-events-none opacity-0",
        className,
      )}
    >
      {/* What is on now. */}
      {nowPlaying ? (
        <div className="flex min-w-0 items-center gap-x-2.5 px-3 pt-2.5 sm:px-4 sm:pt-3">
          {nowPlaying}
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-col gap-1.5 px-3 pb-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:pb-2.5",
          nowPlaying ? "pt-1.5" : "pt-2.5",
        )}
      >
        {/* The live chrome: the badge, the buffer bar, the quality chip and
            the way back to the edge. It takes a row of its own on a phone,
            and joins the bar row from `sm` up. */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:order-2 sm:gap-3">
          <LiveBadge />
          <LiveBar fill={liveFill(liveWindow)} liveWindow={liveWindow} onSeek={onSeek} />
          {quality}
          {behindLive && onJumpToLive ? (
            <LiveJump onJump={onJumpToLive} />
          ) : null}
        </div>

        {/* The transport. */}
        <div className="flex shrink-0 items-center gap-1.5 sm:order-1 sm:gap-2">
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
            className="hidden h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/15 accent-signal lg:block"
            aria-label="Volum"
          />

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
              <span className="hidden lg:inline">Flux următor</span>
            </Button>
          ) : null}

          <div className="ml-auto flex items-center gap-2 sm:ml-0">
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

            {canFullscreen ? (
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
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
