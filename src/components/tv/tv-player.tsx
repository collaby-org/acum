/**
 * The sticky player for the TV browse layout.
 *
 * The player stays pinned to the top of the viewport (`sticky top-0 z-30
 * h-[55vh]`) so when a user opens a channel from the grid the video stays
 * visible while the rest of the list scrolls underneath — exactly what a
 * remote user needs: watch the stream, scroll the directory, never lose the
 * picture.
 */
"use client";

import { VideoPlayer, type VideoPlayerProps } from "@/components/player/video-player";

export type TVPlayerProps = VideoPlayerProps;

export function TVPlayer(props: TVPlayerProps) {
  return (
    <div className="sticky top-0 z-30 h-[55vh] overflow-hidden bg-black shadow-2xl">
      <VideoPlayer {...props} className="h-full w-full rounded-none border-0" />
    </div>
  );
}
