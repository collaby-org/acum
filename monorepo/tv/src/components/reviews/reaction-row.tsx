"use client";

import { useEffect, useRef } from "react";
import { Hand, Heart, ThumbsUp } from "lucide-react";
import { TVFocusable } from "@/components/tv/focusable";
import {
  REACTION_KINDS,
  type ReactionKind,
  type Review,
} from "@/components/reviews/types";
import { pressPoint, type ZoomPoint } from "@/components/reviews/zoom-overlay";
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

/** The query that says the visitor asked for less movement. */
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * A counter that moves when it changes.
 *
 * A number that jumps from one glyph position to another with nothing in
 * between reads as a glitch, not as a change: the eye sees the digits
 * replace themselves rather than the number moving. So the number is
 * animated where it stands — it lifts a little and settles back — and the
 * motion is skipped entirely when the visitor asked for less of it.
 *
 * The value itself is the server's, or the optimistic copy of it while a
 * write is in the air. This component never changes a number; it only
 * shows that the number it was given is a different one.
 */
function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const previous = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (previous.current === value) return;
    previous.current = value;

    // Less movement asked for: the new number is simply there.
    if (
      typeof window === "undefined" ||
      !window.matchMedia ||
      window.matchMedia(REDUCED_QUERY).matches
    ) {
      return;
    }

    if (typeof node.animate !== "function") return;

    node.animate(
      [
        { transform: "translateY(-0.3em) scale(0.82)", opacity: 0.35 },
        { transform: "translateY(0) scale(1)", opacity: 1 },
      ],
      { duration: 280, easing: "cubic-bezier(0.22, 1.14, 0.36, 1)" },
    );
  }, [value]);

  return (
    <span ref={ref} className="min-w-4 text-center tabular-nums">
      {value}
    </span>
  );
}

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
          <TVFocusable
            key={kind}
            aria-pressed={own}
            aria-label={`${kind === "clap" ? "Aplaudă" : kind === "love" ? "Iubesc" : "Îmi place"} — ${review.counts[kind]}`}
            onClick={(event) => {
              const point = pressPoint(event);
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
              // The hit area follows the television's own control size
              // (40 px), while the icon and the number keep their size.
              "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1",
              "text-[12px] tabular-nums transition-[color,border-color,background-color] duration-300 ease-[var(--ease-swift)]",
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
            <Counter value={review.counts[kind]} />
          </TVFocusable>
        );
      })}
    </div>
  );
}
