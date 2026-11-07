"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Radio, Trash2, Tv } from "lucide-react";
import { TVFocusable } from "@/components/tv/focusable";
import type { Review } from "@/components/reviews/types";
import { ReactionRow } from "@/components/reviews/reaction-row";
import { Stars } from "@/components/reviews/star-rating";
import { pressPoint, type ZoomPoint } from "@/components/reviews/zoom-overlay";

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
 *
 * A review the visitor wrote is marked as theirs, and it carries the two
 * things that can be done to it: edit it, delete it. Both act on the
 * server's copy of the review — the one the read store holds — and the
 * server has the last word on whether they are allowed.
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
  /**
   * Opens the composer on this review.
   *
   * The review handed over is the one the server sent, so the composer
   * fills itself from the truth and not from a reconstruction.
   */
  onEdit?: (review: Review, point: ZoomPoint) => void;
  /**
   * Deletes the review through the server-backed store.
   *
   * The row leaves the list only once the server says it is gone.
   */
  onDelete?: (reviewId: string) => Promise<{ ok: boolean; error?: string }>;
};

export function ReviewCard({
  review,
  busy,
  signedIn,
  onReact,
  onRequireSession,
  onEdit,
  onDelete,
}: ReviewCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const slot = slotAt(review.programmeStartsAt);

  // The delete control disappears when the question appears. A remote
  // must not have to find the new answer from the top of the page, so the
  // focus follows the question.
  useEffect(() => {
    if (confirming) confirmButtonRef.current?.focus({ preventScroll: true });
  }, [confirming]);

  /** Ask once, then let the server answer. */
  const deleteReview = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    setError(null);
    const answer = await onDelete(review.id);
    setDeleting(false);
    if (answer.ok) {
      // The row is gone from the store, and with it this card.
      setConfirming(false);
      return;
    }
    setError(answer.error ?? "Recenzia nu a putut fi ștearsă.");
  };

  return (
    <li
      data-testid="review-card"
      className="relative rounded-[var(--radius-card)] border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5"
    >
      {/* Who, and when. */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-ink-muted">
          <span className="truncate">{review.authorLabel}</span>
          {review.mine ? (
            <span className="shrink-0 rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 text-[10px] font-semibold text-signal">
              Recenzia ta
            </span>
          ) : null}
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

      {/* What they said. A television has no hover, so the whole review is
          shown instead of hiding the rest behind a pointer-only tooltip. */}
      <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-ink">
        {review.body}
      </p>

      {/* What can be done to a review of the visitor's own. */}
      {review.mine && (onEdit || onDelete) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onEdit ? (
            <TVFocusable
              aria-label="Editează recenzia"
              onClick={(event) => onEdit(review, pressPoint(event))}
              className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink"
            >
              <Pencil aria-hidden className="size-4" />
            </TVFocusable>
          ) : null}
          {onDelete ? (
            <TVFocusable
              ref={deleteButtonRef}
              aria-label="Șterge recenzia"
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
              className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ink-muted transition-colors duration-300 hover:border-live/40 hover:text-[#ffb3b8]"
            >
              <Trash2 aria-hidden className="size-4" />
            </TVFocusable>
          ) : null}
        </div>
      ) : null}

      {/* The question that comes before the deletion. */}
      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-live/30 bg-live/10 px-3 py-2.5">
          <p className="text-[13px] font-medium text-ink">Ștergi recenzia?</p>
          <TVFocusable
            ref={confirmButtonRef}
            onClick={() => void deleteReview()}
            disabled={deleting}
            className="inline-flex h-10 items-center justify-center rounded-full border border-live/40 bg-live/15 px-4 text-[13px] font-semibold text-[#ffb3b8] transition-colors duration-300 hover:bg-live/25 disabled:pointer-events-none disabled:opacity-40"
          >
            Șterge
          </TVFocusable>
          <TVFocusable
            onClick={() => {
              setConfirming(false);
              setError(null);
              deleteButtonRef.current?.focus({ preventScroll: true });
            }}
            disabled={deleting}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-[13px] font-medium text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            Anulează
          </TVFocusable>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#ffb3b8]"
        >
          {error}
        </p>
      ) : null}

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
