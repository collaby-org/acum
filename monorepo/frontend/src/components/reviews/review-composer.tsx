"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PenLine, Radio, X } from "lucide-react";
import { ZoomOverlay, type ZoomPoint } from "@/components/reviews/zoom-overlay";
import { StarPicker } from "@/components/reviews/star-rating";
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

/** The draft the composer hands to the section. */
export type ComposerDraft = {
  rating: number;
  body: string;
  channelId: string;
  programmeTitle: string | null;
  programmeStartsAt: string | null;
  programmeEndsAt: string | null;
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
  /** Called when the visitor closes. The panel animates out first. */
  onClose: () => void;
  /** Called with the draft, and answers with whatever the server said. */
  onSubmit: (draft: ComposerDraft) => Promise<{
    ok: boolean;
    error?: string;
    needsSession?: boolean;
  }>;
};

/** The shortest comment that is a comment. */
const BODY_MIN = 2;
/** The longest comment one review may carry. */
const BODY_MAX = 1200;

/** The shape every field in this panel wears. */
const inputClass =
  "mt-2 h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[14px] text-ink transition-colors duration-300 placeholder:text-ink-faint hover:border-white/20 focus:border-signal/60 focus:outline-none focus:ring-2 focus:ring-signal/25";

export function ReviewComposer({
  channels,
  open,
  origin = null,
  face = "write",
  onClose,
  onSubmit,
}: ReviewComposerProps) {
  const [channelId, setChannelId] = useState("");
  const [now, setNow] = useState<NowProgramme | null>(null);
  const [nowState, setNowState] = useState<"idle" | "loading" | "ready">("idle");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The face actually shown, which the server can change. */
  const [shown, setShown] = useState<"write" | "session">(face);

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
   * What is on, on the channel the visitor picks.
   *
   * Read from the endpoint that already answers with it, rather than
   * guessed at here: the programme a review is attached to is a fact
   * about the schedule, and the schedule is the server's to read. A
   * review with no programme in the guide is a review of the channel and
   * says so.
   */
  useEffect(() => {
    if (!channelId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset for the "no channel" branch only
      setNow(null);
       
      setNowState("idle");
      return;
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
          now?: { title?: string; startsAt?: string | null } | null;
        };
        setNow(
          detail.now?.title
            ? {
                title: detail.now.title,
                startsAt: detail.now.startsAt ?? null,
                endsAt: null,
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
  }, [channelId]);

  const canWrite = rating > 0 && body.trim().length >= BODY_MIN && Boolean(channelId);

  const submit = useCallback(async () => {
    if (sending) return;
    setError(null);

    if (!channelId) {
      setError("Alege canalul despre care scrii.");
      return;
    }
    if (rating === 0) {
      setError("Alege un rating, de la 1 la 5 stele.");
      return;
    }
    const text = body.trim();
    if (text.length < BODY_MIN) {
      setError("Scrie câteva cuvinte despre emisiune.");
      return;
    }

    setSending(true);
    const answer = await onSubmit({
      rating,
      body: text.slice(0, BODY_MAX),
      channelId,
      programmeTitle: now?.title ?? null,
      programmeStartsAt: now?.startsAt ?? null,
      programmeEndsAt: now?.endsAt ?? null,
    });
    setSending(false);

    if (answer.ok) {
      setRating(0);
      setBody("");
      onClose();
      return;
    }

    setError(answer.error ?? "Recenzia nu a putut fi salvată.");

    // The server said there is no session here: the panel becomes the
    // session face, and the way in is the accounts page.
    if (answer.needsSession) setShown("session");
  }, [body, channelId, now, onClose, onSubmit, rating, sending]);

  /** Where the visitor is now, so the accounts page can bring them back. */
  const returnTo =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}${window.location.hash}`;

  const signInHref = `/conturi?intent=signin&next=${encodeURIComponent(returnTo)}`;
  const registerHref = `/conturi?intent=register&next=${encodeURIComponent(returnTo)}`;

  return (
    <ZoomOverlay
      open={open}
      origin={origin}
      onClose={onClose}
      label={shown === "session" ? "Conectează-te" : "Scrie o recenzie"}
      className="sm:max-w-xl"
    >
      {/* The header: what this is, and the way out. */}
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/[0.07] bg-canvas-raised/85 px-4 py-3.5 backdrop-blur-xl sm:px-5">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-signal">
          <PenLine aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {shown === "session" ? "Conectează-te" : "Scrie o recenzie"}
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">
            {shown === "session"
              ? "Recenziile și reacțiile aparțin unui cont, ca să rămână oameni."
              : "Despre ce rulează acum, pe canalul pe care îl privești."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="grid size-8 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {shown === "session" ? (
        <div className="px-4 py-5 sm:px-5">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Lectura recenziilor este deschisă pentru toți. Scrierea și
            reacțiile cer un cont — ca numerele să rămână ale oamenilor, nu
            ale unui console.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href={signInHref}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-signal px-5 text-[14px] font-semibold text-signal-ink transition-transform duration-300 ease-[var(--ease-spring)] hover:bg-signal-bright active:scale-[0.98]"
            >
              Autentifică-te
            </Link>
            <Link
              href={registerHref}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 text-[14px] font-medium text-ink transition-colors duration-300 hover:border-white/20"
            >
              Creează un cont
            </Link>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 sm:px-5">
          {/* The channel. */}
          <label
            htmlFor="review-channel"
            className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
          >
            Canal
          </label>
          <select
            id="review-channel"
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            className={inputClass}
          >
            <option value="">Alege canalul…</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>

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
                Acum: <span className="text-ink">{now.title}</span>
              </p>
            ) : channelId && nowState === "ready" ? (
              <p className="text-[12px] leading-snug text-ink-faint">
                Ghidul nu are o emisiune pentru acest canal acum. Recenzia va
                rămâne pe canal.
              </p>
            ) : null}
          </div>

          {/* The rating. */}
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Rating
            </p>
            <div className="mt-2 flex items-center gap-3">
              <StarPicker value={rating} onChange={setRating} disabled={sending} />
              <span className="text-[12px] tabular-nums text-ink-faint">
                {rating > 0 ? `${rating} din 5` : "Fără rating"}
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
              rows={4}
              value={body}
              maxLength={BODY_MAX}
              onChange={(event) => setBody(event.target.value)}
              disabled={sending}
              placeholder="Ce ți s-a părut. Despre ce a fost, nu despre site."
              className={cn(inputClass, "resize-none")}
            />
            <p className="mt-1.5 text-right text-[11px] tabular-nums text-ink-faint">
              {body.trim().length}/{BODY_MAX}
            </p>
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
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="h-10 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[13px] font-medium text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          Renunță
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending || !canWrite}
          className={cn(
            "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-[background-color,transform] duration-300",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
            "bg-signal text-signal-ink hover:bg-signal-bright active:scale-[0.98]",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          {sending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <PenLine aria-hidden className="size-4" />
          )}
          Publică recenzia
        </button>
      </div>
    </ZoomOverlay>
  );
}
