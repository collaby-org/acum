/**
 * The overlay the visitor taps when the browser holds the picture back.
 *
 * A browser will not start a video with sound unless the visitor asked for
 * it, and some of them will not start it at all. When that happens the
 * picture stays black and the visitor is left guessing — so the player puts
 * a button over the frame and waits for the tap. The tap is a gesture, and
 * a gesture is exactly what the browser is asking for.
 *
 * The same file carries the quieter pill: the picture is running, but it is
 * running without sound, and one tap brings the sound back.
 */
"use client";

import { Play, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export type MuteOverlayProps = {
  /** True when the overlay covers the picture. */
  visible: boolean;
  /** The line above the button. */
  title: string;
  /** The line under the button. */
  hint?: string;
  /** The button's label, read by the screen reader. */
  label: string;
  /** What the button does: it starts the picture, with sound when it can. */
  onStart: () => void;
  className?: string;
};

export function MuteOverlay({
  visible,
  title,
  hint,
  label,
  onStart,
  className,
}: MuteOverlayProps) {
  if (!visible) return null;

  return (
    <div
      data-slot="mute-overlay"
      className={cn(
        "absolute inset-0 z-30 grid place-items-center bg-black/72 px-6 text-center",
        className,
      )}
    >
      <div className="max-w-xs">
        <button
          type="button"
          onClick={onStart}
          aria-label={label}
          className="mx-auto grid size-16 place-items-center rounded-full bg-signal text-signal-ink shadow-[var(--shadow-glow)] transition-transform duration-300 ease-spring hover:scale-105 active:scale-95"
        >
          <Play className="size-7 translate-x-[1px] fill-current" />
        </button>
        <p className="mt-4 font-display text-base font-semibold text-ink">
          {title}
        </p>
        {hint ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type SoundHintProps = {
  /** True while the picture runs without sound. */
  visible: boolean;
  /** What the pill does: it brings the sound back. */
  onEnable: () => void;
  className?: string;
};

export function SoundHint({ visible, onEnable, className }: SoundHintProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onEnable}
      aria-label="Aprinde sunetul"
      className={cn(
        "absolute bottom-3 left-3 z-20 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/65 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/90 backdrop-blur-md transition-colors duration-300 hover:bg-black/85",
        className,
      )}
    >
      <VolumeX className="size-3.5" aria-hidden />
      Apasă pentru sunet
    </button>
  );
}
