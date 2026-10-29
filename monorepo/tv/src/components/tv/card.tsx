"use client";

import { STATUS_META } from "@/lib/channel-meta";
import type { EpgGuide } from "@/components/now-next";
import type { Quality } from "@/data/types";
import type { ChannelLike } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ChannelScreen } from "@/components/channel-card";
import { TVFocusable } from "./focusable";

/**
 * A channel, as a television presents it.
 *
 * It reuses the catalogue card's screen — the still of what is on air,
 * the channel's own logo as the broadcast bug, the family's rim of light
 * — because that part was already right. What a television changes is
 * everything around it:
 *
 * - **One target, not many.** There is no hover to reveal a title, no
 *   favourite button hiding in a corner waiting for a pointer that will
 *   never arrive. The whole card is one button, and Enter plays it.
 * - **The card is bigger.** Read at three metres, not at thirty
 *   centimetres. The row's gap carries it up rather than the card.
 * - **Focus is announced three ways at once** — the gold ring
 *   (`tv-focus-ring`), the card growing towards the viewer, and the rest
 *   of the row falling back into the dark. You cannot lose your place,
 *   and you can always see what you are *not* on.
 */

export type TVChannelCardProps<T extends ChannelLike> = {
  channel: T;
  /** The action the card performs. Enter runs it. */
  onPlay: (channel: T) => void;
  /** The day's guide, so the screen can name what is on right now. */
  guide?: EpgGuide | null;
  /** The picture quality, when the caller knows it better than the channel does. */
  quality?: Quality | null;
  /** How many people are watching right now, when the caller knows. */
  views?: number | null;
  /** The source's cumulative popularity counter, when the caller knows. */
  popularity?: number | null;
  className?: string;
};

export function TVChannelCard<T extends ChannelLike>({
  channel,
  onPlay,
  guide,
  quality,
  views,
  popularity,
  className,
}: TVChannelCardProps<T>) {
  const status = STATUS_META[channel.status];
  const viewers = views ?? 0;
  const popular = popularity ?? channel.views ?? 0;
  const onAir = channel.status === "live" || viewers > 0 || popular > 0;

  // The name of the thing, spoken the way a screen reader should speak
  // it: what it is, whether it is on, and how many are watching. The
  // visual card says all three already; a spoken one needs them in words.
  const label = [
    `Vizionează ${channel.name}`,
    onAir ? "live acum" : status.label.toLowerCase(),
    viewers > 0 ? `${viewers.toLocaleString("ro-RO")} de spectatori` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <TVFocusable
      onClick={() => onPlay(channel)}
      aria-label={label}
      className={cn(
        "group/card tv-card-focus relative z-0 block w-[19rem] shrink-0 rounded-[var(--radius-card)] text-left",
        "focus:z-20",
        className,
      )}
    >
      <ChannelScreen
        channel={channel}
        guide={guide}
        badge={quality}
        // The screen counts a crowd, so "not counted" is `undefined`; a
        // null would read as a count of zero.
        views={views ?? undefined}
        popularity={popularity}
        // No plans on a television. The way in is a phone carrying a QR code,
        // and a "buy a plan" chip on a card is a door to a room this device
        // cannot enter.
        showPlans={false}
      />
    </TVFocusable>
  );
}
