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
import { ExternalLink, Radio } from "lucide-react";
import type { Channel } from "@/data/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VideoPlayer, type PlayerHandle } from "@/components/player/video-player";
import type { PlayerStatus } from "@/hooks/use-player";

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

  const sourcePage = channel.servers.find((server) => server.sourcePage)?.sourcePage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="overflow-hidden rounded-2xl border border-white/10 bg-canvas-raised p-0 shadow-[0_40px_120px_-30px_rgba(0,0,0,1)]"
      >
        <DialogTitle className="sr-only">{channel.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Player live pentru {channel.name}
        </DialogDescription>

        <VideoPlayer
          ref={playerRef}
          channelName={channel.name}
          servers={channel.servers}
          autoPlay={open}
          onStatusChange={onStatusChange}
          className="rounded-none border-0"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 bg-canvas-raised px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
              <Radio className="size-4 text-live" />
              {channel.name}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{channel.family}</p>
          </div>

          {sourcePage ? (
            <Button variant="ghost" size="sm" asChild>
              <a href={sourcePage} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-4" />
                Pagina sursă
              </a>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
