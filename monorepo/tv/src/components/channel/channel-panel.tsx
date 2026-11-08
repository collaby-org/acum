/**
 * The channel panel.
 *
 * It opens with the player and asks `/api/channel/<id>` what the channel is:
 * how many people watch it, what it is about and what is on the air right
 * now. The answer arrives finished — the guide and the directory are read on
 * the server — so the panel only has to print it.
 *
 * The panel is deliberately quiet: the picture is the thing, the panel is
 * the caption under it.
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Image from "next/image";
import {
  Eye,
  Pencil,
  PenLine,
  Radio,
  RefreshCw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { formatClock } from "@/components/now-next";
import { ProgrammeBadges } from "@/components/player/programme-badges";
import {
  ReviewComposer,
  type ComposerChannel,
  type ComposerProgramme,
  type ZoomPoint,
} from "@/components/reviews";
import { Stars } from "@/components/reviews/star-rating";
import type { Review } from "@/components/reviews/types";
import { TVFocusable } from "@/components/tv/focusable";
import { accountToken, useAccount } from "@/hooks/use-account";
import { useMyChannelReviews } from "@/hooks/use-reviews";
import { useMinuteTick } from "@/hooks/use-guide-clock";
import { cn } from "@/lib/utils";

/** One slot of the guide, as the endpoint prints it. */
export type PanelProgramme = {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  description: string | null;
};

/** The sheet the endpoint answers with. */
export type ChannelSheet = {
  id: string;
  name: string;
  views: number | null;
  liveViewers: number;
  category: string;
  description: string | null;
  now: PanelProgramme | null;
  next: PanelProgramme[];
};

export type ChannelPanelProps = {
  /** The catalogue id of the channel. */
  channelId: string;
  /** The name shown while the sheet is on its way. */
  channelName?: string;
  /** The family shown under the name. */
  family?: string;
  /** The channel's mark, when it has one. */
  logo?: string | null;
  /**
   * False when the surface around the panel already names the channel —
   * the player dialog does, in its own header.
   */
  showIdentity?: boolean;
  className?: string;
};

const NUMBER = new Intl.NumberFormat("ro-RO");

/**
 * Two different numbers, and the panel says which is which.
 *
 * `liveViewers` is ours: the number of browsers watching this channel here,
 * counted at the proxy over the last minute and a half. That is a crowd.
 *
 * `views` is the directory's own counter, and it is cumulative — sampled
 * twice, seventy seconds apart, it had barely moved. It is a popularity
 * ranking, and it is never dressed up as an audience.
 */
function liveLabel(count: number): string | null {
  if (!count || count <= 0) return null;
  return `${NUMBER.format(count)} în direct acum`;
}

function popularityLabel(views: number | null): string | null {
  if (views === null || views <= 0) return null;
  return `popularitate ${NUMBER.format(views)}`;
}

/** The clock of a stamp, in Romanian time. */
function clockOf(stamp: string | null): string | null {
  if (!stamp) return null;
  const moment = Date.parse(stamp);
  if (Number.isNaN(moment)) return null;
  return formatClock(moment);
}

/** The visitor's own review, with the actions it really supports. */
function OwnReviewCard({
  review,
  confirming,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  review: Review;
  confirming: boolean;
  onEdit: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-testid="channel-own-review"
      className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3.5"
    >
      <div className="flex items-center gap-2">
        <Stars value={review.rating} />
        <span className="text-[11px] tabular-nums text-ink-faint">
          {review.rating}/5
        </span>
      </div>
      <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink">
        {review.body}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TVFocusable
          aria-label="Editează recenzia"
          title="Editează recenzia"
          onClick={onEdit}
          className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink"
        >
          <Pencil aria-hidden className="size-4" />
        </TVFocusable>
        <TVFocusable
          aria-label="Șterge recenzia"
          title="Șterge recenzia"
          onClick={onAskDelete}
          className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ink-muted transition-colors duration-300 hover:border-live/40 hover:text-[#ffb3b8]"
        >
          <Trash2 aria-hidden className="size-4" />
        </TVFocusable>
      </div>
      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-live/30 bg-live/10 px-3 py-2.5">
          <p className="text-[13px] font-medium text-ink">Ștergi recenzia?</p>
          <TVFocusable
            onClick={onDelete}
            className="inline-flex h-11 items-center justify-center rounded-full border border-live/40 bg-live/15 px-4 text-[13px] font-semibold text-[#ffb3b8] transition-colors duration-300 hover:bg-live/25"
          >
            Șterge
          </TVFocusable>
          <TVFocusable
            onClick={onCancelDelete}
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-[13px] font-medium text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink"
          >
            Anulează
          </TVFocusable>
        </div>
      ) : null}
    </div>
  );
}

export function ChannelPanel({
  channelId,
  channelName,
  family,
  logo,
  showIdentity = true,
  className,
}: ChannelPanelProps) {
  // The sheet belongs to the channel it was asked for: when the channel
  // changes, the old sheet is not shown under the new name.
  const [state, setState] = useState<{
    id: string;
    sheet: ChannelSheet | null;
    failed: boolean;
  }>({ id: channelId, sheet: null, failed: false });

  /**
   * The counter that asks for the sheet again.
   *
   * A failed read is not an empty channel: the panel says so and offers a
   * retry, and the retry is a new read of the same channel.
   */
  const [reloadToken, setReloadToken] = useState(0);

  /** The composer and the place on the screen it was asked from. */
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerOrigin, setComposerOrigin] = useState<ZoomPoint | null>(null);
  /** Whether the delete is waiting for a second answer. */
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** What the server said about the last thing the viewer asked for. */
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * The sheet is read from the server, so it is the server's clock that
   * decides what is on. The minute tick is what makes it move: once a
   * minute the panel asks again, and the answer is the programme that is on
   * air now — not the one that was on when the panel was opened.
   */
  const tick = useMinuteTick();
  const account = useAccount();
  const myReviews = useMyChannelReviews(channelId);

  useEffect(() => {
    let live = true;

    fetch(`/api/channel/${encodeURIComponent(channelId)}`)
      .then((response) => {
        if (!response.ok) throw new Error("bad status");
        return response.json() as Promise<ChannelSheet>;
      })
      .then((data) => {
        if (live) setState({ id: channelId, sheet: data, failed: false });
      })
      .catch(() => {
        if (live) setState({ id: channelId, sheet: null, failed: true });
      });

    return () => {
      live = false;
    };
  }, [channelId, tick, reloadToken]);

  /**
   * Ask for the sheet again.
   *
   * The desk did not answer the last time; it may answer now. The panel
   * goes back to its waiting shape while it tries.
   */
  const retry = useCallback(() => {
    setState({ id: channelId, sheet: null, failed: false });
    setReloadToken((value) => value + 1);
  }, [channelId]);

  /** Open the composer from the control the remote just activated. */
  const openComposer = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      setComposerOrigin({
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
      });
      setComposerOpen(true);
    },
    [],
  );

  const closeComposer = useCallback(() => setComposerOpen(false), []);

  /**
   * The viewer's own review of the programme that is on air right now.
   *
   * The same programme, the same way: the title is compared without its
   * case, and the start of the slot has to be the same instant. A review
   * of yesterday's programme is a different review, and the panel says
   * so by not showing it here.
   */
  const ownReview = useMemo(() => {
    const now = state.id === channelId ? state.sheet?.now : null;
    if (!now) return null;

    const sameTitle = (value: string | null): string | null =>
      value?.trim().toLocaleLowerCase("ro-RO") ?? null;
    const sameInstant = (a: string | null, b: string | null): boolean => {
      if (a === null || b === null) return a === b;
      const first = new Date(a).getTime();
      const second = new Date(b).getTime();
      if (!Number.isFinite(first) || !Number.isFinite(second)) return a === b;
      return first === second;
    };

    return (
      myReviews.reviews.find(
        (review) =>
          review.mine &&
          review.channelId === channelId &&
          sameTitle(review.programmeTitle) === sameTitle(now.title) &&
          (!review.programmeTitle ||
            sameInstant(review.programmeStartsAt, now.startsAt)),
      ) ?? null
    );
  }, [channelId, myReviews.reviews, state.id, state.sheet?.now]);

  /** Change the review, and let the server have the last word. */
  const updateReview = useCallback(
    async (
      reviewId: string,
      changes: { rating?: number; body?: string },
    ) => {
      const answer = await myReviews.update(reviewId, changes);
      if (!answer.ok) setNotice(answer.error);
      else {
        setNotice(null);
        myReviews.reload();
      }
      return answer;
    },
    [myReviews],
  );

  /** Take the review away, when the viewer says so twice. */
  const removeReview = useCallback(
    async (reviewId: string) => {
      const answer = await myReviews.remove(reviewId);
      if (!answer.ok) {
        setNotice(answer.error);
        return answer;
      }
      setNotice(null);
      setConfirmingDelete(false);
      myReviews.reload();
      return answer;
    },
    [myReviews],
  );

  const sheet = state.id === channelId ? state.sheet : null;
  const failed = state.id === channelId ? state.failed : false;

  const name = sheet?.name ?? channelName ?? "";
  const live = liveLabel(sheet?.liveViewers ?? 0);
  const popular = popularityLabel(sheet?.views ?? null);
  const nowClock = clockOf(sheet?.now?.startsAt ?? null);
  const nowEnd = clockOf(sheet?.now?.endsAt ?? null);
  const composerChannels: ComposerChannel[] = [{ id: channelId, name }];
  const composerProgramme: ComposerProgramme | null = sheet?.now
    ? {
        title: sheet.now.title,
        startsAt: sheet.now.startsAt,
        endsAt: sheet.now.endsAt,
        channelId,
      }
    : null;

  return (
    <section
      data-slot="channel-panel"
      className={cn("flex min-w-0 flex-col gap-4", className)}
    >
      {/* The programme comes first: it is what the visitor came to see. */}
      <div aria-live="polite">
        {sheet?.now ? (
          <div
            data-slot="channel-programme"
            className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5"
          >
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-signal/85">
              <Radio className="size-3" aria-hidden />
              Acum
            </p>
            <h2 className="mt-2 font-display text-[19px] font-semibold leading-tight tracking-tight text-ink">
              {sheet.now.title}
            </h2>
            {nowClock ? (
              <p className="mt-1 font-mono text-[11px] tabular-nums tracking-wide text-ink-faint">
                {nowClock}
                {nowEnd ? ` — ${nowEnd}` : ""}
              </p>
            ) : null}
            {sheet.now.description ? (
              <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-ink-muted">
                {sheet.now.description}
              </p>
            ) : null}
            <ProgrammeBadges
              channelId={channelId}
              title={sheet.now.title}
              className="mt-2"
            />
            <TVFocusable
              data-testid="channel-review-trigger"
              onClick={openComposer}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-signal px-5 text-[14px] font-semibold text-signal-ink transition-[background-color,transform] duration-300 ease-[var(--ease-spring)] hover:bg-signal-bright"
            >
              {ownReview ? (
                <Pencil aria-hidden className="size-4" />
              ) : (
                <PenLine aria-hidden className="size-4" />
              )}
              {ownReview ? "Editează recenzia" : "Scrie o recenzie"}
            </TVFocusable>

            {myReviews.failed ? (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-live/30 bg-live/10 p-3.5"
              >
                <p className="text-[13px] font-medium leading-relaxed text-ink">
                  Recenziile tale nu au putut fi citite acum.
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                  Încearcă din nou ca să poți vedea sau edita recenzia.
                </p>
                <TVFocusable
                  onClick={myReviews.reload}
                  className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 text-[13px] font-medium text-ink transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.08]"
                >
                  <RefreshCw aria-hidden className="size-4" />
                  Încearcă din nou
                </TVFocusable>
              </div>
            ) : null}

            {ownReview ? (
              <OwnReviewCard
                review={ownReview}
                confirming={confirmingDelete}
                onEdit={openComposer}
                onAskDelete={() => {
                  setNotice(null);
                  setConfirmingDelete(true);
                }}
                onCancelDelete={() => setConfirmingDelete(false)}
                onDelete={() => void removeReview(ownReview.id)}
              />
            ) : null}

            {notice ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#ffb3b8]"
              >
                {notice}
              </p>
            ) : null}
          </div>
        ) : failed ? (
          <div
            role="alert"
            data-slot="channel-programme-error"
            className="rounded-2xl border border-live/30 bg-live/10 p-3.5"
          >
            <p className="text-[13px] font-medium leading-relaxed text-ink">
              Programul nu poate fi citit acum.
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
              Încearcă din nou ca să vezi ce rulează în acest moment.
            </p>
            <TVFocusable
              onClick={retry}
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 text-[13px] font-medium text-ink transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.08]"
            >
              <RefreshCw aria-hidden className="size-4" />
              Încearcă din nou
            </TVFocusable>
          </div>
        ) : sheet ? (
          <p
            data-slot="channel-programme-empty"
            className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 text-[13px] leading-relaxed text-ink-faint"
          >
            Programul nu este disponibil pentru acest canal
          </p>
        ) : (
          <div className="space-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5" aria-hidden>
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-5 w-4/5 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
          </div>
        )}
      </div>

      {sheet && sheet.next.length > 0 ? (
        <div data-slot="channel-next">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            Urmează
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {sheet.next.map((programme, index) => {
              const clock = clockOf(programme.startsAt);
              return (
                <li
                  key={`${programme.startsAt ?? index}-${programme.title}`}
                  className="flex min-w-0 items-baseline gap-2.5"
                >
                  {clock ? (
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-signal/85">
                      {clock}
                    </span>
                  ) : null}
                  <span className="truncate text-[13px] text-ink-muted">
                    {programme.title}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Name and the mark */}
      {showIdentity ? (
        <div className="flex items-start gap-3">
          {logo ? (
            <span className="relative grid h-11 w-14 shrink-0 max-w-[4.5rem] place-items-center overflow-hidden rounded-[9px] border border-white/12 bg-white/[0.06] sm:w-[60px] sm:max-w-none">
              <Image
                src={logo}
                alt=""
                width={60}
                height={44}
                unoptimized
                className="h-11 w-full object-contain p-1 opacity-95"
              />
            </span>
          ) : (
            <span
              aria-hidden
              className="grid h-11 w-[60px] shrink-0 place-items-center rounded-[9px] border border-white/12 bg-white/[0.06] font-display text-sm font-bold text-ink-muted"
            >
              {name.slice(0, 2).toUpperCase()}
            </span>
          )}

          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold tracking-tight text-ink">
              {name}
            </h2>
            {family ? (
              <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                {family}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* What the directory knows */}
      {sheet ? (
        <div className="flex flex-wrap items-center gap-2">
          {sheet.category ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {sheet.category}
            </span>
          ) : null}
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-live/30 bg-live/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-live-soft">
              <Eye className="size-3" aria-hidden />
              {live}
            </span>
          ) : null}
          {popular ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              <TrendingUp className="size-3" aria-hidden />
              {popular}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* The channel's own text */}
      <div data-slot="channel-about">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
          Despre canal
        </h3>
        {sheet?.description ? (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            {sheet.description}
          </p>
        ) : failed ? (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
            Detaliile canalului nu pot fi citite acum.
          </p>
        ) : sheet ? (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
            Canalul nu are o descriere.
          </p>
        ) : (
          <div className="mt-2 space-y-2" aria-hidden>
            <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.06]" />
          </div>
        )}
      </div>

      <ReviewComposer
        channels={composerChannels}
        signedIn={account.signedIn}
        open={composerOpen}
        origin={composerOrigin}
        face={account.signedIn ? "write" : "session"}
        programme={composerProgramme}
        review={ownReview}
        reviews={myReviews.reviews}
        onClose={closeComposer}
        onSubmit={async (draft) => {
          // The write goes out under the viewer's own token, so the
          // database policies are the second line of defence after the
          // bearer check — not instead of it.
          const token = await accountToken();
          const response = await fetch("/api/reviews", {
            method: "POST",
            headers: {
              ...(token ? { authorization: `Bearer ${token}` } : {}),
              "content-type": "application/json",
            },
            body: JSON.stringify(draft),
            cache: "no-store",
          });
          const payload = (await response
            .json()
            .catch(() => null)) as {
            review?: Review;
            error?: string;
            needsSession?: boolean;
          } | null;

          if (!response.ok || !payload?.review) {
            return {
              ok: false,
              error: payload?.error ?? "Recenzia nu a putut fi salvată.",
              needsSession: Boolean(payload?.needsSession),
            };
          }

          myReviews.reload();
          return { ok: true };
        }}
        onUpdate={updateReview}
      />
    </section>
  );
}
