/**
 * A ready-made modal around the picture.
 *
 * Escape closes it, a click on the backdrop closes it, focus is trapped
 * inside and restored on close, and the page behind it stops scrolling —
 * all of it comes from the Radix dialog the app already uses.
 *
 * The picture sits on the left, the channel panel on the right: what the
 * channel is, how many people watch it and what is on the air right now.
 * On a phone the two stack — the picture on top, the panel under it.
 *
 * The integrator can adopt this file as it is, or lift `VideoPlayer` into
 * their own modal and drive it through the imperative handle.
 */
"use client";

import { useEffect, useRef } from "react";
import { Radio, X } from "lucide-react";
import type { Channel } from "@/data/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VideoPlayer, type PlayerHandle } from "@/components/player/video-player";
import { ChannelPanel } from "@/components/channel/channel-panel";
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
          // The picture decides how tall the dialog is, so the width is
          // capped by the height of the window: a short window gets a
          // narrower picture, not a cut-off one.
          "md:max-h-[86vh] md:max-w-[min(72rem,calc((86vh-3.5rem)*1.7778))]",
        )}
      >
        <DialogTitle className="sr-only">{channel.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Player live pentru {channel.name}
        </DialogDescription>

        {/* The picture on the left, the panel on the right. The panel is
            taken out of the flow on a desktop, so the dialog is exactly as
            tall as the picture and the panel scrolls inside it. */}
        <div className="relative flex min-h-0 flex-col overflow-hidden md:flex-row">
          {/* The picture */}
          <div className="flex min-h-0 flex-1 flex-col bg-black md:pr-[340px]">
            <VideoPlayer
              ref={playerRef}
              channelName={channel.name}
              channelId={channel.id}
              autoPlay={open}
              onStatusChange={onStatusChange}
              className="rounded-none border-0 max-sm:min-h-0 max-sm:flex-1"
            />
          </div>

          {/* The channel panel */}
          <aside
            className={cn(
              "flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-white/8 bg-canvas-raised p-4 sm:p-5",
              "max-sm:max-h-[46vh]",
              "md:absolute md:inset-y-0 md:right-0 md:w-[340px] md:border-l md:border-t-0",
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                  <Radio className="size-4 shrink-0 text-live" />
                  <span className="truncate">{channel.name}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {channel.family}
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChange(false)}
                aria-label="Închide playerul"
                title="Închide"
              >
                <X className="size-4" />
              </Button>
            </div>

            <ChannelPanel
              channelId={channel.id}
              channelName={channel.name}
              family={channel.family}
              logo={channel.logo}
              showIdentity={false}
            />
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
