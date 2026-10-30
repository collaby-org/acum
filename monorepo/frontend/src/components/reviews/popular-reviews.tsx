"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, PenLine } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import { useReviews } from "@/hooks/use-reviews";
import { ReviewCard } from "@/components/reviews/review-card";
import {
  ReviewComposer,
  type ComposerChannel,
} from "@/components/reviews/review-composer";
import type { ZoomPoint } from "@/components/reviews/zoom-overlay";

/**
 * The popular reviews, on the front door.
 *
 * The section is honest about an empty shelf. There is no seed data, no
 * borrowed list and no invented author anywhere behind it: while the
 * reviews are nobody's, it says so and offers the composer. A section
 * that looked busy on a product with no reviews would be lying on the
 * homepage, which is the worst place for it.
 *
 * The order is the blend in `@/lib/review-rank` — reaction weight with a
 * decay — and it is decided on the server, so the browser cannot arrange
 * the section differently. What the browser decides is only *when* to
 * ask, and what to show while a request is in the air.
 *
 * Reading is open. Writing and reacting ask for a session at the moment
 * of the act: a visitor who is not signed in sees the same reviews and
 * the same counts, and is asked to sign in when they try to write one,
 * not one screen earlier.
 */

export type PopularReviewsProps = {
  /** The catalogue, as ids and names. Passed in rather than imported, so
   *  the browser bundle holds the names and none of the sources. */
  channels: ComposerChannel[];
  className?: string;
};

/** What a press hands over: the thing that was pressed. */
type PressEvent = { currentTarget: HTMLElement };

export function PopularReviews({ channels, className }: PopularReviewsProps) {
  const { signedIn } = useAccount();
  // `start` is bound out of the store because it is the stable function
  // (a useCallback), and an effect that depends on a stable function runs
  // once — while one that depends on the store object the linter cannot
  // prove stable is asked to run again on every render.
  const reviews = useReviews();
  const startReviews = reviews.start;

  const [open, setOpen] = useState(false);
  // Named, not inline: the composer reads this in an effect keyed on the
  // panel's presence, and a new function identity on every render would
  // ask that effect to run again for no reason.
  const close = useCallback(() => setOpen(false), []);
  const [face, setFace] = useState<"write" | "session">("write");
  /** Where the panel was asked for: the press, or the centre of what was
   *  pressed when a keyboard did it. */
  const [origin, setOrigin] = useState<ZoomPoint | null>(null);
  /** Something the visitor should be told, from a failed action. */
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // One read per mount: the store is module-level, so a second section
    // on the page would reuse it rather than ask again. The function is
    // bound out of the store at module scope, so the dependency is the
    // function itself and not the whole store object.
    void startReviews();
  }, [startReviews]);

  const ask = useCallback((event?: PressEvent) => {
    const from = event?.currentTarget?.getBoundingClientRect() ?? null;
    setOrigin(
      from ? { x: from.left + from.width / 2, y: from.top + from.height / 2 } : null,
    );
    setFace("write");
    setOpen(true);
  }, []);

  const react = useCallback(
    async (reviewId: string, kind: "clap" | "love" | "like" | null) => {
      setNotice(null);
      const answer = await reviews.react(reviewId, kind);
      if (!answer.ok) {
        // A visitor who is not signed in is asked at the moment they act,
        // with the panel arriving from where they pressed.
        if (answer.needsSession) {
          setFace("session");
          setOpen(true);
          return;
        }
        setNotice(answer.error);
      }
    },
    [reviews],
  );

  const write = useCallback(
    async (draft: {
      rating: number;
      body: string;
      channelId: string;
      programmeTitle: string | null;
      programmeStartsAt: string | null;
      programmeEndsAt: string | null;
    }) => {
      setNotice(null);
      const answer = await reviews.submit(draft);
      if (!answer.ok) {
        if (answer.needsSession) setFace("session");
        return { ok: false, error: answer.error, needsSession: answer.needsSession };
      }
      return { ok: true };
    },
    [reviews],
  );

  const empty = reviews.loaded && reviews.reviews.length === 0;

  return (
    <section
      id="recenzii"
      aria-labelledby="recenzii-title"
      className={className}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
            Recenzii
          </p>
          <h2
            id="recenzii-title"
            className="mt-3 font-display text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-balance text-ink"
          >
            Recenzii populare
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            Ce spun privitorii despre ce rulează acum, pe fiecare canal.
            Ordonate după reacții — aplauze, iubiri, aprecieri — și după
            cât de recente sunt, ca nu primul review scris să rămână sus
            pentru totdeauna.
          </p>
        </div>

        {/* The way in. Present in every state, because there is never a
            version of this section where writing is not offered. */}
        <button
          type="button"
          data-testid="review-composer-trigger"
          onClick={(event) => ask(event)}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 text-[14px] font-medium text-ink transition-[color,border-color,transform] duration-300 ease-[var(--ease-spring)] hover:border-signal/40 hover:text-signal-bright active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          <PenLine aria-hidden className="size-4" />
          Scrie o recenzie
        </button>
      </div>

      {/* A notice about a failed action, said once and clearly. */}
      {notice ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#ffb3b8]"
        >
          {notice}
        </p>
      ) : null}

      <div className="mt-8 min-h-[8rem]">
        {!reviews.loaded ? (
          <p className="text-[13px] text-ink-faint">Se citesc recenziile…</p>
        ) : !reviews.configured ? (
          <EmptyState
            title="Recenziile nu pot fi citite acum"
            detail={
              reviews.reason ??
              "Ceva nu merge la server. Încearcă din nou într-un moment."
            }
            action={{ label: "Scrie o recenzie", onPress: ask }}
          />
        ) : empty ? (
          <EmptyState
            title="Nicio recenzie încă"
            detail="Fii primul care scrie despre ce rulează acum. O recenzie e un rating și câteva cuvinte — și rămâne legată de emisiunea despre care a fost scrisă."
            action={{ label: "Scrie prima recenzie", onPress: ask }}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {reviews.reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                busy={reviews.busy.includes(review.id)}
                signedIn={signedIn}
                onReact={react}
                onRequireSession={(point) => {
                  setOrigin(point);
                  setFace("session");
                  setOpen(true);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <ReviewComposer
        channels={channels}
        signedIn={signedIn}
        open={open}
        origin={origin}
        face={face}
        onClose={close}
        onSubmit={write}
      />
    </section>
  );
}

/**
 * An empty section, and what it offers.
 *
 * Two empty states, and they are different: one is about us (the desk
 * cannot be read) and one is about the shelf (nobody has written yet).
 * Pretending they are the same would be the small lie this whole section
 * exists to avoid.
 */
function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action: {
    label: string;
    onPress: (event?: PressEvent) => void;
  };
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-white/[0.07] bg-white/[0.02] p-6 sm:p-8">
      <span className="grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-ink-faint">
        <MessageSquare aria-hidden className="size-4.5" />
      </span>
      <h3 className="mt-4 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h3>
      <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-ink-muted">
        {detail}
      </p>
      <button
        type="button"
        data-testid="review-composer-empty-trigger"
        onClick={(event) => action.onPress(event)}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-signal px-5 text-[14px] font-semibold text-signal-ink transition-transform duration-300 ease-[var(--ease-spring)] hover:bg-signal-bright active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        <PenLine aria-hidden className="size-4" />
        {action.label}
      </button>
    </div>
  );
}
