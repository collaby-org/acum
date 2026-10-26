/**
 * The channel page — the phone's answer to the player dialog.
 *
 * The picture is at the top, the channel panel under it, the back control
 * in the corner and the bottom bar at the foot of the screen. The page
 * works the same in a browser tab and in the installed app: the back
 * control is a real link to the catalogue, not a history entry that may
 * not be there.
 */
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Channel } from "@/data/types";
import { VideoPlayer } from "@/components/player/video-player";
import { ChannelPanel } from "@/components/channel/channel-panel";
import { MOBILE_NAV_SPACE, MobileNav } from "@/components/mobile-nav";
import { cn } from "@/lib/utils";

export type CanalScreenProps = {
  /**
   * The channel, as the browser sees it: names, artwork, status and
   * quality — no upstream address, no source page.
   */
  channel: Channel;
};

export function CanalScreen({ channel }: CanalScreenProps) {
  const router = useRouter();

  return (
    <div className={cn("min-h-dvh bg-canvas", MOBILE_NAV_SPACE)}>
      {/* The top bar: the way back. The channel names itself in the panel
          below the picture, so it is not repeated here. */}
      <header
        className={cn(
          "sticky top-0 z-40 flex items-center gap-3 border-b border-white/[0.07] bg-canvas/85 backdrop-blur-xl",
          "px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3",
        )}
      >
        <button
          type="button"
          onClick={() => router.push("/")}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4",
            "text-[13px] font-semibold text-ink backdrop-blur-md transition-colors duration-300",
            "hover:border-white/20 hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Înapoi acasă
        </button>
      </header>

      {/* The picture — pinned; only the panel scrolls. */}
      <div className="sticky top-0 z-30 bg-black">
        <VideoPlayer
          channelName={channel.name}
          channelId={channel.id}
          autoPlay
          className="rounded-none border-0"
        />
      </div>

      {/* The channel panel. */}
      <div className="px-4 py-5 sm:px-6">
        <ChannelPanel
          channelId={channel.id}
          channelName={channel.name}
          family={channel.family}
          logo={channel.logo}
        />
      </div>

      {/* The bottom bar — the same one the catalogue carries. */}
      <MobileNav active={null} />
    </div>
  );
}
