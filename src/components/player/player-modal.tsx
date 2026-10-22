/**
 * A ready-made modal around the picture.
 *
 * Escape closes it, a click on the backdrop closes it, focus is trapped
 * inside and restored on close, and the page behind it stops scrolling —
 * all of it comes from the Radix dialog the app already uses.
 *
 * The integrator can adopt this file as it is, or lift `VideoPlayer` into
 * their own modal and drive it through the imperative handle.
 */
"use client";

import { useEffect, useRef } from "react";
import { Radio } from "lucide-react";
import type { Channel } from "@/data/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoPlayer, type PlayerHandle } from "@/components/player/video-player";
import type { PlayerStatus } from "@/hooks/use-player";
import { cn } from "@/lib/utils";

export type PlayerModalProps = {
  channel: Channel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called on every transition of the playback state machine. */
  onStatusChange?: (status: PlayerStatus) => void;
};

export function PlayerModal({
  channel,
  open,
  onOpenChange,
  onStatusChange,
}: PlayerModalProps) {
  const playerRef = useRef<PlayerHandle>(null);

  // The dialog content mounts a tick after `open` flips, so the picture is
  // started by `autoPlay`; this call only matters when the player was
  // already on screen.
  useEffect(() => {
    if (open) playerRef.current?.play();
  }, [open, channel?.id]);

  if (!channel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className={cn(
          // On a phone the player is the whole screen: no margins, no
          // rounded frame, the picture as large as the viewport allows.
          "max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none",
          "max-sm:border-0 max-sm:bg-black max-sm:shadow-none",
          "max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0",
          "max-sm:overscroll-contain",
          // Everywhere else it is the dialog it has always been.
          "rounded-2xl border border-white/10 bg-canvas-raised shadow-[0_40px_120px_-30px_rgba(0,0,0,1)]",
        )}
      >
        <DialogTitle className="sr-only">{channel.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Player live pentru {channel.name}
        </DialogDescription>

        <div className="flex h-full min-h-0 flex-col bg-black">
          <VideoPlayer
            ref={playerRef}
            channelName={channel.name}
            channelId={channel.id}
            autoPlay={open}
            onStatusChange={onStatusChange}
            className="rounded-none border-0 max-sm:min-h-0 max-sm:flex-1"
          />

          <div
            className={cn(
              "flex flex-wrap items-center gap-3 border-t border-white/8 bg-canvas-raised px-4 py-3",
              // On a phone the name sits above the picture, clear of the notch.
              "max-sm:order-first max-sm:shrink-0 max-sm:border-t-0 max-sm:border-b",
              "max-sm:pt-[max(0.75rem,env(safe-area-inset-top))]",
            )}
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                <Radio className="size-4 text-live" />
                {channel.name}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{channel.family}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
