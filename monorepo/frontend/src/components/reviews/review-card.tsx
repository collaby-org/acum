"use client";

import { Radio, Tv } from "lucide-react";
import type { Review } from "@/components/reviews/types";
import { ReactionRow } from "@/components/reviews/reaction-row";
import { Stars } from "@/components/reviews/star-rating";
import type { ZoomPoint } from "@/components/reviews/zoom-overlay";

/**
 * One review.
 *
 * What it says is what the row says: who, how much, of what, and when.
 * Nothing is added on the way — no avatar, no badge, no "top critic",
 * no anonymous-but-not-really author. The site has no such thing, and
 * inventing one would be the exact failure the issue names.
 *
 * The two chips under the name are what make a review survive the
 * schedule: the channel is a catalogue channel, and the programme is the
 * slot that was on when the review was written. When the schedule rolls
 * over, the review is still findable because it says which show it was.
 */

/** A moment in the past, in the words a person counts with. */
function when(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";

  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "acum";
  if (minutes < 60) return `acum ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `acum ${hours} ${hours === 1 ? "oră" : "ore"}`;

  const days = Math.round(hours / 24);
  if (days === 1) return "ieri";
  if (days < 30) return `acum ${days} zile`;

  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(then));
}

/** When a slot started, as a short stamp. */
function slotAt(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(then);
}

export type ReviewCardProps = {
  review: Review;
  busy?: boolean;
  signedIn: boolean;
  onReact: (reviewId: string, kind: Review["own"]) => void;
  onRequireSession: (point: ZoomPoint) => void;
};

export function ReviewCard({
  review,
  busy,
  signedIn,
  onReact,
  onRequireSession,
}: ReviewCardProps) {
  const slot = slotAt(review.programmeStartsAt);

  return (
    <li
      data-testid="review-card"
      className="relative rounded-[var(--radius-card)] border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5"
    >
      {/* Who, and when. */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[12px] font-medium text-ink-muted">
          {review.authorLabel}
        </p>
        <p className="shrink-0 text-[11px] tabular-nums text-ink-faint">
          {when(review.createdAt)}
        </p>
      </div>

      {/* How much. */}
      <div className="mt-2 flex items-center gap-2.5">
        <Stars value={review.rating} />
        <span className="text-[11px] tabular-nums text-ink-faint">
          {review.rating}/5
        </span>
      </div>

      {/* Of what. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
        <span className="inline-flex items-center gap-1.5">
          <Tv aria-hidden className="size-3.5" />
          {review.channelName}
        </span>
        {review.programmeTitle ? (
          <span className="inline-flex items-center gap-1.5">
            <Radio aria-hidden className="size-3.5 text-live" />
            <span className="text-ink-muted">{review.programmeTitle}</span>
            {slot ? <span className="tabular-nums">· {slot}</span> : null}
          </span>
        ) : null}
      </div>

      {/* What they said. */}
      <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-ink">
        {review.body}
      </p>

      {/* And how many people agree. */}
      <ReactionRow
        review={review}
        busy={busy}
        signedIn={signedIn}
        onReact={onReact}
        onRequireSession={onRequireSession}
        className="mt-3.5"
      />
    </li>
  );
}
