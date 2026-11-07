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

import { useEffect, useId, useRef } from "react";
import { Radio } from "lucide-react";
import type { Channel } from "@/data/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoPlayer, type PlayerHandle } from "@/components/player/video-player";
import { PlayerChrome } from "@/components/player/player-controls";
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
  /** The history entry this modal owns while it is open. */
  const historyEntryRef = useRef(false);
  /** Whether the last close came from the browser's Back button. */
  const closedByPopStateRef = useRef(false);
  /** The latest parent callback, without making the history effect re-run. */
  const onOpenChangeRef = useRef(onOpenChange);
  /** Marks this modal's history entry without changing the visible URL. */
  const historyMarker = useId();

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  // The browser's Back button belongs to the player: opening it adds one
  // entry, and Back returns to the page without the player.
  useEffect(() => {
    if (!open) return;

    closedByPopStateRef.current = false;
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.history.pushState(
      { ...window.history.state, acumPlayer: historyMarker },
      "",
      window.location.href,
    );
    historyEntryRef.current = true;

    const onPopState = () => {
      if (!historyEntryRef.current) return;
      historyEntryRef.current = false;
      closedByPopStateRef.current = true;
      onOpenChangeRef.current(false);
    };

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.history.scrollRestoration = previousRestoration;
      historyEntryRef.current = false;
    };
  }, [historyMarker, open]);

  // The dialog content mounts a tick after `open` flips, so the picture is
  // started by `autoPlay`; this call only matters when the player was
  // already on screen.
  useEffect(() => {
    if (open) playerRef.current?.play();
  }, [open, channel?.id]);

  if (!channel) return null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && open && historyEntryRef.current && !closedByPopStateRef.current) {
      // A close button or Escape must consume the history entry the modal
      // added, so the next Back still belongs to the page behind it.
      historyEntryRef.current = false;
      window.history.back();
    }
    closedByPopStateRef.current = false;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-slot="player-dialog"
        className={cn(
          // On a phone the player is the whole screen: no margins, no
          // rounded frame, the picture as large as the viewport allows.
          "max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none",
          "max-sm:border-0 max-sm:bg-black max-sm:shadow-none",
          "max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0",
          "max-sm:overscroll-contain",
          // The installed iOS app draws edge to edge. The frame, the close
          // control and the panel all stay inside the notch and the home
          // indicator instead of hiding beneath them.
          "max-sm:pl-[var(--safe-left)] max-sm:pr-[var(--safe-right)]",
          "max-sm:pt-[var(--safe-top)] max-sm:pb-[var(--safe-bottom)]",
          // Everywhere else it is the dialog it has always been. The one
          // radius belongs to this shell: the picture and the panel are
          // clipped by it, so nothing inside is rounded on its own.
          "overflow-hidden rounded-2xl border border-white/10 bg-canvas-raised shadow-[0_40px_120px_-30px_rgba(0,0,0,1)]",
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
            <PlayerChrome className="flex min-h-0 flex-1 flex-col">
              <VideoPlayer
                ref={playerRef}
                channelName={channel.name}
                channelId={channel.id}
                autoPlay={open}
                onStatusChange={onStatusChange}
                className="rounded-none border-0 max-sm:min-h-0 max-sm:flex-1"
              />
            </PlayerChrome>
          </div>

          {/* The channel panel */}
          <aside
            className={cn(
              "flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-white/8 bg-canvas-raised p-4 sm:p-5",
              "max-sm:max-h-[46vh]",
              "md:absolute md:inset-y-0 md:right-0 md:w-[340px] md:border-l md:border-t-0",
            )}
          >
            {/* The room on the right is for the dialog's one close button,
                which floats over this corner in every layout. */}
            <div className="mb-4 flex items-start gap-3 pr-10">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                  <Radio className="size-4 shrink-0 text-live" />
                  <span className="truncate">{channel.name}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {channel.family}
                </p>
              </div>
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
