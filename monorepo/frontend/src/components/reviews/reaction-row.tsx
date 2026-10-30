"use client";

import { Hand, Heart, ThumbsUp } from "lucide-react";
import {
  REACTION_KINDS,
  type ReactionKind,
  type Review,
} from "@/components/reviews/types";
import type { ZoomPoint } from "@/components/reviews/zoom-overlay";
import { cn } from "@/lib/utils";

/**
 * The row of reactions.
 *
 * Three buttons, three counts, and the reader's own reaction filled in.
 * One reaction per visitor: pressing a second kind moves it, and
 * pressing the kind that is already on takes it off. That is not a rule
 * the browser enforces — the primary key in the database is (review,
 * account), so there is nothing for a second one to go into.
 *
 * The number on the button is the number the server last said. While a
 * reaction is in the air the row shows where it is heading and marks
 * itself busy, and the answer replaces it. A counter that only exists in
 * the browser is not a counter.
 */

/** The icon each reaction wears. Lucide, three of them, one each. */
const ICONS: Record<ReactionKind, typeof Hand> = {
  clap: Hand,
  love: Heart,
  like: ThumbsUp,
};

export type ReactionRowProps = {
  review: Review;
  /** True when a request for this review is still in the air. */
  busy?: boolean;
  signedIn: boolean;
  onReact: (reviewId: string, kind: ReactionKind | null) => void;
  /** Called when a visitor who is not signed in tries to act. */
  onRequireSession: (point: ZoomPoint) => void;
  className?: string;
};

export function ReactionRow({
  review,
  busy = false,
  signedIn,
  onReact,
  onRequireSession,
  className,
}: ReactionRowProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      role="group"
      aria-label="Reacții"
      aria-busy={busy}
    >
      {REACTION_KINDS.map((kind) => {
        const Icon = ICONS[kind];
        const own = review.own === kind;

        return (
          <button
            key={kind}
            type="button"
            aria-pressed={own}
            aria-label={`${kind === "clap" ? "Aplaudă" : kind === "love" ? "Iubesc" : "Îmi place"} — ${review.counts[kind]}`}
            onClick={(event) => {
              const point = { x: event.clientX, y: event.clientY };
              // A visitor who is not signed in is asked for a session at
              // the moment they act, and not one minute earlier.
              if (!signedIn) {
                onRequireSession(point);
                return;
              }
              // The one they already on comes off. Changing is the same
              // gesture, so both live in the same place.
              onReact(review.id, own ? null : kind);
            }}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1",
              "text-[12px] tabular-nums transition-[color,border-color,background-color] duration-300 ease-[var(--ease-swift)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
              own
                ? "border-signal/45 bg-signal/12 text-signal-bright"
                : "border-white/[0.07] bg-white/[0.02] text-ink-muted hover:border-white/15 hover:text-ink",
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "size-3.5 transition-transform duration-300 ease-[var(--ease-spring)]",
                own && "scale-110",
              )}
            />
            <span className="min-w-4 text-center">{review.counts[kind]}</span>
          </button>
        );
      })}
    </div>
  );
}
