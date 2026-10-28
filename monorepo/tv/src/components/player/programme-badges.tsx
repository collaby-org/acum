"use client";

import type { ReactNode } from "react";
import { resolveBadge, type AccessibilityFlag } from "@/lib/programme-badges";
import { cn } from "@/lib/utils";

/**
 * What an accessibility flag is called, in full.
 *
 * The letter alone means nothing to a viewer who is new to it; the pill
 * carries the full Romanian name in its tooltip and its accessible name.
 */
const FLAG_LABEL: Record<AccessibilityFlag, string> = {
  AD: "Audiodescriere",
  S: "Subtitrare",
  SSL: "Limbaj în semne",
};

export type ProgrammeBadgesProps = {
  /** The catalogue channel the programme airs on, when we know it. */
  channelId: string | null;
  /** The programme on air. With no title there is nothing to badge. */
  title: string | null;
  className?: string;
};

/**
 * The ITVX-style metadata row: accessibility flags, genre, then the age
 * rating with its reason, in one wrapping line of pills.
 *
 * It paints exactly what the resolver can support and nothing more — an
 * empty row is no row at all, so the whole component returns null rather
 * than holding space open for a pill that never comes.
 */
export function ProgrammeBadges({ channelId, title, className }: ProgrammeBadgesProps) {
  const { genre, rating, reasons, flags } = resolveBadge(channelId, title ?? "");

  const groups: ReactNode[] = [];

  if (flags.length > 0) {
    groups.push(
      <span
        key="flags"
        data-slot="programme-badges-flags"
        className="flex items-center gap-1"
      >
        {flags.map((flag) => (
          <span
            key={flag}
            data-slot="programme-badge"
            data-badge="flag"
            title={FLAG_LABEL[flag]}
            aria-label={FLAG_LABEL[flag]}
            className="inline-flex h-[19px] min-w-[24px] items-center justify-center rounded-[6px] border border-white/12 bg-white/[0.06] px-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-ink-muted backdrop-blur-sm"
          >
            <span aria-hidden>{flag}</span>
          </span>
        ))}
      </span>,
    );
  }

  if (genre) {
    groups.push(
      <span
        key="genre"
        data-slot="programme-badge"
        data-badge="genre"
        className="inline-flex h-[19px] items-center rounded-full border border-white/12 bg-white/[0.06] px-2 text-[10.5px] font-medium leading-none tracking-[0.02em] text-ink-muted backdrop-blur-sm"
      >
        {genre}
      </span>,
    );
  }

  const hasRatingRow = Boolean(rating) || reasons.length > 0;
  if (hasRatingRow) {
    groups.push(
      <span
        key="rating"
        data-slot="programme-badges-rating"
        className="flex items-center gap-1.5"
      >
        {rating ? (
          <span
            data-slot="programme-badge"
            data-badge="rating"
            title="Clasificare de vârstă"
            className="inline-flex h-[19px] items-center rounded-[6px] border border-white/14 bg-white/[0.08] px-1.5 text-[10.5px] font-semibold tabular-nums leading-none text-ink backdrop-blur-sm"
          >
            {rating}
          </span>
        ) : null}
        {rating && reasons.length > 0 ? (
          <span aria-hidden className="text-ink-faint">
            ·
          </span>
        ) : null}
        {reasons.length > 0 ? (
          <span className="text-[10.5px] leading-none text-ink-muted">
            {reasons.join(", ")}
          </span>
        ) : null}
      </span>,
    );
  }

  if (groups.length === 0) return null;

  // One row: the groups, with a middot between each — the punctuation
  // ITVX uses, drawn at the faint ink so it never becomes a fourth pill.
  const nodes: ReactNode[] = [];
  groups.forEach((group, index) => {
    if (index > 0) {
      nodes.push(
        <span key={`sep-${index}`} aria-hidden className="text-ink-faint">
          ·
        </span>,
      );
    }
    nodes.push(group);
  });

  return (
    <div
      data-slot="programme-badges"
      role="group"
      aria-label="Detalii program"
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}
    >
      {nodes}
    </div>
  );
}
