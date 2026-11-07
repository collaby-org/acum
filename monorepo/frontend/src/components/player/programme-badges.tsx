"use client";

import { ProgrammeBadgeRow } from "@/components/programme-badges/badge-row";

export type ProgrammeBadgesProps = {
  /** The catalogue channel the programme airs on, when we know it. */
  channelId: string | null;
  /** The programme on air. With no title there is nothing to badge. */
  title: string | null;
  className?: string;
};

/**
 * The player's programme badges.
 *
 * The row itself has one owner — the shared programme-badges component —
 * so the player, the channel panel and the catalogue cards all speak the
 * same badge vocabulary.
 */
export function ProgrammeBadges({ channelId, title, className }: ProgrammeBadgesProps) {
  return (
    <ProgrammeBadgeRow
      channelId={channelId}
      title={title}
      className={className}
    />
  );
}
