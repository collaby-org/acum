"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Loader2, Pencil, PenLine, Radio, X } from "lucide-react";
import { TVFocusable } from "@/components/tv/focusable";
import {
  pressPoint,
  useZoomDismiss,
  ZoomOverlay,
  type ZoomPoint,
} from "@/components/reviews/zoom-overlay";
import { StarPicker } from "@/components/reviews/star-rating";
import type { Review } from "@/components/reviews/types";
import { cn } from "@/lib/utils";

/**
 * The composer.
 *
 * Opened from a button, never a navigation: the page behind the panel
 * stays exactly where the visitor left it, and the panel arrives from the
 * point they pressed. On a phone it is a sheet instead of a panel, with
 * the safe area under it, and on the way out it goes back into the point
 * that dismissed it — see `zoom-overlay.tsx` for that mechanism.
 *
 * It has two faces. The writing face is a rating, a channel, what is on
 * that channel right now, and a comment. The session face is what a
 * visitor who is not signed in gets, and it appears at the moment they
 * act rather than before it: reading the reviews and pressing a reaction
 * are both open, and both ask for an account at the point of writing.
 *
 * It has two modes as well. A review the visitor already wrote is
 * edited, not written again: the panel says so, it shows what the server
 * holds, and it saves through the update path instead of inserting a
 * second row for the same slot.
 *
 * Nothing here is stored in the browser. The draft lives in state so the
 * panel can be closed and reopened, and the moment the visitor submits,
 * the server writes it or it is not written.
 */

/** A channel, as the section knows it: an id and a name. */
export type ComposerChannel = { id: string; name: string };

/** What was on a channel when the composer asked. */
type NowProgramme = {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
} | null;

/**
 * What the server says is on, on the channel the composer is about.
 *
 * The server reads the guide against the real clock; the browser does not
 * have the guide, and what it has is a second late. So the composer takes
 * the server's answer when there is one.
 */
export type ComposerProgramme = {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  /**
   * The channel the programme belongs to, when the caller knows it. A
   * composer opened for one channel may still let the visitor pick
   * another, and the other channel is then read on its own.
   */
  channelId?: string;
};

/** The draft the composer hands to the section. */
export type ComposerDraft = {
  rating: number;
  body: string;
  channelId: string;
  programmeTitle: string | null;
  programmeStartsAt: string | null;
  programmeEndsAt: string | null;
};

/** What a write answers with: it worked, or it did not and why. */
export type ComposerAnswer = {
  ok: boolean;
  error?: string;
  needsSession?: boolean;
};

export type ReviewComposerProps = {
  channels: ComposerChannel[];
  /**
   * Whether a session exists. The server decides the face from its own
   * answer, so this is only a first-paint hint; the request that follows
   * is what actually swaps it.
   */
  signedIn: boolean;
  /** True while the panel is wanted on screen. */
  open: boolean;
  /** The point the panel was asked for. */
  origin?: ZoomPoint | null;
  /** Which face: writing, or the session a write needs. */
  face?: "write" | "session";
  /**
   * The programme the server resolved, or `null` when the server says
   * the guide has nothing for this channel now.
   *
   * Left out, the composer asks the channel endpoint itself — a fallback,
   * not the source of truth. Given, the browser invents nothing: the
   * server's answer is shown, and the server's "there is no programme" is
   * shown as exactly that.
   */
  programme?: ComposerProgramme | null;
  /**
   * The review being edited, when the composer was opened from one of the
   * visitor's own reviews. The values shown here come from the server's
   * read store; the composer does not reconstruct them from a guess.
   */
  review?: Review | null;
  /**
   * The reviews the store holds, when the caller has them.
   *
   * They are used for one thing only: to find the visitor's own review of
   * the slot they are writing about, so it is edited instead of written a
   * second time. What the store holds is what the server said, so even
   * this is not a guess.
   */
  reviews?: Review[];
  /**
   * Called when the visitor closes. The optional point is where the
   * control that dismissed the composer was pressed.
   */
  onClose: (point?: ZoomPoint) => void;
  /** Called with the draft, and answers with whatever the server said. */
  onSubmit: (draft: ComposerDraft) => Promise<ComposerAnswer>;
  /**
   * Called when an existing review is saved. Left out, the composer can
   * still write new reviews but refuses to pretend it can edit one.
   */
  onUpdate?: (
    reviewId: string,
    changes: { rating: number; body: string },
  ) => Promise<ComposerAnswer>;
};

/** The shortest comment that is a comment. */
const BODY_MIN = 2;
/** The longest comment one review may carry. */
const BODY_MAX = 1200;

/**
 * The shape every field in this panel wears.
 *
 * The text is 16 pixels on a phone, because anything smaller makes iOS
 * Safari zoom the whole page the moment the field is focused. On a wide
 * screen the smaller size is fine, and it is kept there.
 */
const inputClass =
  "mt-2 h-10 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-base text-ink transition-colors duration-300 placeholder:text-ink-faint hover:border-white/20 focus:border-signal/60 focus:outline-none tv-focus-ring-soft sm:text-sm";

/**
 * The comment field, which is not a field but a page.
 *
 * A comment of twelve hundred characters is not something anybody writes
 * in a line and a half, so the field is a page of its own: 152 pixels on a
 * phone, where the keyboard takes the rest, and a little less on a wide
 * screen. The counter sits under it, in the flow, and never over it.
 */
const textareaClass =
  "mt-2 min-h-[9.5rem] w-full resize-none appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-base leading-relaxed text-ink transition-colors duration-300 placeholder:text-ink-faint hover:border-white/20 focus:border-signal/60 focus:outline-none tv-focus-ring-soft sm:min-h-[8.5rem] sm:text-sm";

/** Two instants that say the same moment, whichever way they are written. */
function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  const first = new Date(a).getTime();
  const second = new Date(b).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(second)) return a === b;
  return first === second;
}

/** A title, said the same way twice. */
function sameTitle(a: string | null, b: string | null): boolean {
  const first = a?.trim().toLocaleLowerCase("ro-RO") ?? null;
  const second = b?.trim().toLocaleLowerCase("ro-RO") ?? null;
  return first === second;
}

/**
 * Whether a review is about the slot the composer is showing.
 *
 * A slot is a channel and the programme that was on it. A review with no
 * programme is a review of the channel itself, and it matches the
 * channel alone.
 */
function sameSlot(
  review: Review,
  channelId: string,
  programme: NowProgramme,
): boolean {
  if (review.channelId !== channelId) return false;
  if (!sameTitle(review.programmeTitle, programme?.title ?? null)) return false;
  if (!review.programmeTitle) return true;
  return sameInstant(review.programmeStartsAt, programme?.startsAt ?? null);
}

export function ReviewComposer(props: ReviewComposerProps) {
  return (
    <ComposerPanel
      key={props.review?.id ?? "new"}
      {...props}
    />
  );
}

/**
 * The composer itself.
 *
 * It is remounted when the visitor switches between writing a new review
 * and editing an existing one. That is what makes the edit form honest:
 * every field starts from the server's review, with no draft from the
 * previous form left behind to be mistaken for it.
 */
function ComposerPanel({
  channels,
  open,
  origin = null,
  face = "write",
  programme,
  review = null,
  reviews: storeReviews,
  onClose,
  onSubmit,
  onUpdate,
}: ReviewComposerProps) {
  const [channelId, setChannelId] = useState(
    review?.channelId ?? (channels.length === 1 ? channels[0].id : ""),
  );
  /**
   * The one channel this panel is about, when there is exactly one.
   *
   * A question with a single answer is not a question: the channel is
   * already known, so it is shown and not asked for.
   */
  const singleChannel = channels.length === 1 ? channels[0] : null;
  const [now, setNow] = useState<NowProgramme | null>(
    review?.programmeTitle
      ? {
          title: review.programmeTitle,
          startsAt: review.programmeStartsAt,
          endsAt: review.programmeEndsAt,
        }
      : null,
  );
  const [nowState, setNowState] = useState<"idle" | "loading" | "ready">(
    review ? "ready" : "idle",
  );
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [body, setBody] = useState(review?.body ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The face actually shown, which the server can change. */
  const [shown, setShown] = useState<"write" | "session">(face);
  /** Whether the visitor has written anything of their own yet. */
  const [touched, setTouched] = useState(false);

  /** True when the panel was opened on one of the visitor's own reviews. */
  const isEdit = review !== null;

  // The face asked for by the section, unless the server has said a
  // session is what this visitor needs.
  useEffect(() => {
    if (!sending) {
      // The face follows the prop and nothing else — the effect only
      // exists to undo the server's "session" swap once the send is
      // over, so it cannot cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors a prop, not a derived loop
      setShown(face);
    }
  }, [face, sending]);

  /**
   * The server's answer about the programme, flattened.
   *
   * The prop is an object, and an object rebuilt on every render of the
   * parent would ask the browser to look the programme up again and again.
   * So what the effect depends on are the values themselves.
   */
  const programmeKnown = programme !== undefined;
  const programmeTitle = programme?.title ?? null;
  const programmeStartsAt = programme?.startsAt ?? null;
  const programmeEndsAt = programme?.endsAt ?? null;
  const programmeChannel = programme?.channelId ?? null;

  /**
   * What is on, on the channel the visitor picks.
   *
   * Read from the endpoint that already answers with it, rather than
   * guessed at here: the programme a review is attached to is a fact
   * about the schedule, and the schedule is the server's to read. A
   * review with no programme in the guide is a review of the channel and
   * says so.
   *
   * When the server has already resolved the programme, that answer is
   * the one used — including its "there is nothing on now". The browser
   * lookup below is the fallback for a channel the server did not answer
   * for, and it never invents a title of its own either.
   */
  useEffect(() => {
    // An edit keeps the programme snapshot the server stored with the
    // review. The live guide is a different fact and must not replace it.
    if (isEdit) return;

    if (!channelId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset for the "no channel" branch only
      setNow(null);
      setNowState("idle");
      return;
    }

    if (programmeKnown) {
      const forThisChannel =
        programmeChannel === null || programmeChannel === channelId;

      if (forThisChannel) {
        setNow(
          programmeTitle
            ? {
                title: programmeTitle,
                startsAt: programmeStartsAt,
                endsAt: programmeEndsAt,
              }
            : null,
        );
        setNowState("ready");
        return;
      }
    }

    let live = true;
    setNowState("loading");

    void (async () => {
      try {
        const response = await fetch(`/api/channel/${encodeURIComponent(channelId)}`, {
          cache: "no-store",
        });
        if (!live) return;
        if (!response.ok) {
          setNow(null);
          setNowState("ready");
          return;
        }
        const detail = (await response.json()) as {
          now?: {
            title?: string;
            startsAt?: string | null;
            endsAt?: string | null;
          } | null;
        };
        setNow(
          detail.now?.title
            ? {
                title: detail.now.title,
                startsAt: detail.now.startsAt ?? null,
                endsAt: detail.now.endsAt ?? null,
              }
            : null,
        );
        setNowState("ready");
      } catch {
        if (!live) return;
        setNow(null);
        setNowState("ready");
      }
    })();

    return () => {
      live = false;
    };
  }, [
    channelId,
    isEdit,
    programmeChannel,
    programmeEndsAt,
    programmeKnown,
    programmeStartsAt,
    programmeTitle,
  ]);

  /**
   * The visitor's own review of the slot they are writing about.
   *
   * Found in the reviews the server already sent, and only there: the
   * browser knows nothing more than the server told it. When such a
   * review is there, the panel edits it instead of asking for a second
   * one — the database would refuse the second one anyway.
   */
  const slotReview = useMemo(() => {
    if (isEdit) return null;
    if (!channelId || nowState !== "ready") return null;
    const list = storeReviews ?? [];
    return (
      list.find(
        (candidate) =>
          candidate.mine && sameSlot(candidate, channelId, now),
      ) ?? null
    );
  }, [isEdit, storeReviews, channelId, now, nowState]);

  /** The review this panel is about, whether it was opened for one or found. */
  const editing = review ?? slotReview;

  /** The channel the panel is about, named and not asked for. */
  const knownChannel = channels.find((channel) => channel.id === channelId);
  const selectedChannel = knownChannel ?? singleChannel;

  /**
   * What the fields show.
   *
   * The visitor's own review of the slot fills them in until the visitor
   * writes something of their own — after that, what they wrote is what
   * they see, and nothing is overwritten under their hands.
   */
  const shownRating = touched ? rating : (slotReview?.rating ?? rating);
  const shownBody = touched ? body : (slotReview?.body ?? body);

  /** Another channel means another subject: the draft starts over. */
  const chooseChannel = useCallback((next: string) => {
    setChannelId(next);
    setRating(0);
    setBody("");
    setTouched(false);
    setError(null);
  }, []);

  const canWrite =
    shownRating > 0 &&
    shownBody.trim().length >= BODY_MIN &&
    Boolean(channelId);

  const submit = useCallback(async () => {
    if (sending) return;
    setError(null);

    if (!channelId) {
      setError("Alege canalul despre care scrii.");
      return;
    }
    if (shownRating === 0) {
      setError("Alege un rating, de la 1 la 5 stele.");
      return;
    }
    const text = shownBody.trim();
    if (text.length < BODY_MIN) {
      setError("Scrie câteva cuvinte despre emisiune.");
      return;
    }

    setSending(true);

    let answer: ComposerAnswer;
    if (editing) {
      // An existing review is changed, never inserted a second time.
      answer = onUpdate
        ? await onUpdate(editing.id, {
            rating: shownRating,
            body: text.slice(0, BODY_MAX),
          })
        : {
            ok: false,
            error: "Recenzia nu poate fi modificată aici.",
            needsSession: false,
          };
    } else {
      answer = await onSubmit({
        rating: shownRating,
        body: text.slice(0, BODY_MAX),
        channelId,
        programmeTitle: now?.title ?? null,
        programmeStartsAt: now?.startsAt ?? null,
        programmeEndsAt: now?.endsAt ?? null,
      });
    }
    setSending(false);

    if (answer.ok) {
      if (!editing) {
        setRating(0);
        setBody("");
        setTouched(false);
      }
      onClose();
      return;
    }

    setError(answer.error ?? "Recenzia nu a putut fi salvată.");

    // The server said there is no session here: the panel becomes the
    // session face, and the way in is the accounts page.
    if (answer.needsSession) setShown("session");
  }, [
    channelId,
    editing,
    now,
    onClose,
    onSubmit,
    onUpdate,
    sending,
    shownBody,
    shownRating,
  ]);

  /** Where the visitor is now, so the accounts page can bring them back. */
  const returnTo =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}${window.location.hash}`;

  const signInHref = `/conturi?intent=signin&next=${encodeURIComponent(returnTo)}`;
  const registerHref = `/conturi?intent=register&next=${encodeURIComponent(returnTo)}`;

  const title =
    shown === "session"
      ? "Conectează-te"
      : editing
        ? "Editează recenzia"
        : "Scrie o recenzie";

  return (
    <ZoomOverlay
      open={open}
      origin={origin}
      onClose={onClose}
      label={title}
      className="sm:max-w-xl"
    >
      {/* The header: what this is, and the way out. */}
      <div className="sticky top-0 z-10 border-b border-white/[0.07] bg-canvas-raised/85 px-4 py-3.5 backdrop-blur-xl sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-signal">
            {editing ? (
              <Pencil aria-hidden className="size-4" />
            ) : (
              <PenLine aria-hidden className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">
              {shown === "session"
                ? "Recenziile și reacțiile aparțin unui cont, ca să rămână oameni."
                : editing
                  ? "Modifici recenzia ta. Canalul și emisiunea rămân cele de la scriere."
                  : "Despre ce rulează acum, pe canalul pe care îl privești."}
            </p>
          </div>
          <DismissButton
            ariaLabel="Închide"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </DismissButton>
        </div>
      </div>

      {shown === "session" ? (
        <div className="px-4 py-5 sm:px-5">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Lectura recenziilor este deschisă pentru toți. Scrierea și
            reacțiile cer un cont — ca numerele să rămână ale oamenilor, nu
            ale unui console.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <TVFocusable
              asChild
              ring="soft"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-signal px-5 text-[14px] font-semibold text-signal-ink transition-transform duration-300 ease-[var(--ease-spring)] hover:bg-signal-bright"
            >
              <Link href={signInHref}>Autentifică-te</Link>
            </TVFocusable>
            <TVFocusable
              asChild
              ring="soft"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 text-[14px] font-medium text-ink transition-colors duration-300 hover:border-white/20"
            >
              <Link href={registerHref}>Creează un cont</Link>
            </TVFocusable>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 sm:px-5">
          {/* The channel. */}
          {editing || singleChannel ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                Canal
              </p>
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                <p className="text-[14px] text-ink">
                  {editing?.channelName ?? selectedChannel?.name}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">
                  {editing
                    ? "Canalul unei recenzii nu se schimbă."
                    : "Recenzia rămâne legată de acest canal."}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="review-channel"
                className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
              >
                Canal
              </label>
              <select
                id="review-channel"
                data-tv-focus=""
                value={channelId}
                onChange={(event) => chooseChannel(event.target.value)}
                className={inputClass}
              >
                <option value="">Alege canalul…</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* What is on it, as the server knows. */}
          <div className="mt-3 min-h-6">
            {channelId && nowState === "loading" ? (
              <p className="inline-flex items-center gap-2 text-[12px] text-ink-faint">
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
                Se citește programul…
              </p>
            ) : now ? (
              <p className="inline-flex items-center gap-2 text-[12px] text-ink-muted">
                <Radio aria-hidden className="size-3.5 text-live" />
                {editing ? "Emisiune: " : "Acum: "}
                <span className="text-ink">{now.title}</span>
              </p>
            ) : channelId && nowState === "ready" ? (
              <p className="text-[12px] leading-snug text-ink-faint">
                {editing
                  ? "Recenzia rămâne legată de canal, fără o emisiune în ghid."
                  : "Ghidul nu are o emisiune pentru acest canal acum. Recenzia va rămâne pe canal."}
              </p>
            ) : null}
          </div>

          {/* The rating. */}
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Rating
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <StarPicker
                value={shownRating}
                onChange={(value) => {
                  setRating(value);
                  setTouched(true);
                }}
                disabled={sending}
              />
              <span className="text-[12px] tabular-nums text-ink-faint">
                {shownRating > 0 ? `${shownRating} din 5` : "Fără rating"}
              </span>
            </div>
          </div>

          {/* The comment. */}
          <div className="mt-4">
            <label
              htmlFor="review-body"
              className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
            >
              Recenzie
            </label>
            <textarea
              id="review-body"
              data-tv-focus=""
              inputMode="text"
              rows={5}
              value={shownBody}
              maxLength={BODY_MAX}
              onChange={(event) => {
                setBody(event.target.value);
                setTouched(true);
              }}
              disabled={sending}
              placeholder="Ce ți s-a părut. Despre ce a fost, nu despre site."
              className={textareaClass}
            />
            <div className="mt-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[11px] text-ink-faint">
                {shownBody.trim().length < BODY_MIN
                  ? "Încă puține cuvinte — scrie cel puțin două."
                  : editing
                    ? "Recenzia ta rămâne legată de emisiunea de la scriere."
                    : "Recenzia rămâne legată de canalul ales."}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
                {shownBody.trim().length}/{BODY_MAX}
              </span>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mb-3 rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#ffb3b8]"
            >
              {error}
            </p>
          ) : null}
        </div>
      )}

      {/* The footer, and its two actions. */}
      <div className="flex items-center gap-3 border-t border-white/[0.07] px-4 py-3.5 sm:px-5">
        <DismissButton
          disabled={sending}
          className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-[13px] font-medium text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          Renunță
        </DismissButton>
        <TVFocusable
          onClick={() => void submit()}
          disabled={sending || !canWrite}
          className={cn(
            "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-[background-color,transform] duration-300",
            "bg-signal text-signal-ink hover:bg-signal-bright",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          {sending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : editing ? (
            <Pencil aria-hidden className="size-4" />
          ) : (
            <PenLine aria-hidden className="size-4" />
          )}
          {editing ? "Salvează recenzia" : "Publică recenzia"}
        </TVFocusable>
      </div>
    </ZoomOverlay>
  );
}

/**
 * A button that dismisses the panel.
 *
 * It hands the overlay the place it was pressed, so the panel leaves
 * towards the control that closed it instead of towards the place it was
 * opened from. A keyboard has no place of its own, so the middle of the
 * button is used.
 */
function DismissButton({
  ariaLabel,
  children,
  className,
  disabled,
}: {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const dismiss = useZoomDismiss();

  return (
    <TVFocusable
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(event) => dismiss(pressPoint(event))}
      className={className}
    >
      {children}
    </TVFocusable>
  );
}
