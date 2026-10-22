/**
 * The notice before the wall.
 *
 * A viewer on the free plan watches the day's allowance run out. Ten minutes
 * before the end, a quiet line appears over the picture: the visitor is told,
 * not interrupted. The picture keeps running, the transport bar stays where
 * it is, and the line goes away on its own if nobody reads it.
 *
 * It goes up once per Romanian day, and never again after that — the key is
 * written the moment the line is shown, so a dismissal and an expiry leave
 * the same trace. The minutes are the server's, not the browser's: the number
 * on screen is the number `/api/account` answered with.
 *
 * It stays quiet for a visitor who is not signed in, on a plan without a
 * limit, when the server has not said how much is left, and behind the wall —
 * there the wall itself is the message.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Plan } from "@/lib/supabase/plans";
import { cn } from "@/lib/utils";

/** The notice appears at this many minutes left, and not one minute earlier. */
const WARN_MINUTES = 10;

/** How long the line stays when it is ignored. */
const LINGER_MS = 12_000;

/** Today, in Romania, spelled the way a storage key spells it. */
function romanianDay(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
  }).format(new Date());
}

/** One notice per Romanian day, per browser. */
function storageKey(): string {
  return `acum.minutes-warning.${romanianDay()}`;
}

/**
 * Whether today's notice has already gone up in this browser.
 *
 * Without storage — private mode, a browser that refuses — there is no way
 * to keep the promise of "once", so the line stays down rather than turn up
 * again and again.
 */
function shownToday(): boolean {
  try {
    return window.localStorage.getItem(storageKey()) !== null;
  } catch {
    return true;
  }
}

/** Written before the line renders: a reload must not bring it back. */
function rememberToday(): void {
  try {
    window.localStorage.setItem(storageKey(), "1");
  } catch {
    /* nothing to write to; the notice is still spent for this visit */
  }
}

export type MinutesWarningProps = {
  /** Somebody is signed in — a visitor on the outside gets the wall, not a warning. */
  signedIn: boolean;
  /** The plan the account is on: only the free plan has an allowance. */
  plan: Plan;
  /** The minutes left today, as the server counted them. */
  remainingMinutes: number | null;
  /** The wall is already up; it says everything the notice would. */
  gated: boolean;
  className?: string;
};

export function MinutesWarning({
  signedIn,
  plan,
  remainingMinutes,
  gated,
  className,
}: MinutesWarningProps) {
  const [armed, setArmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // One look per mount, and the answer is spent either way: a visitor who
  // dismissed it must not meet it again a minute later.
  const [considered, setConsidered] = useState(false);

  const limited =
    signedIn &&
    plan === "free" &&
    !gated &&
    remainingMinutes !== null &&
    remainingMinutes > 0 &&
    remainingMinutes <= WARN_MINUTES;

  // The decision is derived while rendering, the way React asks for state
  // that follows its props: the moment the server says there are ten minutes
  // left, the notice is armed — once, and only if today's has not been spent.
  // The key is written before it renders, so a reload cannot bring it back.
  if (limited && !considered) {
    setConsidered(true);
    if (!shownToday()) {
      rememberToday();
      setArmed(true);
    }
  }

  const open = armed && !dismissed && !gated;

  // A line nobody asked for goes away by itself.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setDismissed(true), LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  const close = useCallback(() => setDismissed(true), []);

  // The wall takes over: the frame is its own, and the notice steps back.
  if (!open) return null;

  // The server counts in fractions of a minute; the viewer reads minutes,
  // rounded up, so a last part of one is never reported as nothing.
  const left = Math.max(1, Math.ceil(remainingMinutes ?? 1));

  return (
    <div
      data-slot="minutes-warning"
      role="status"
      aria-live="polite"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
      className={cn(
        // Over the picture, never over the picture's controls: the top-left
        // corner is the one the transport bar does not reach.
        "absolute left-3 top-3 z-30 flex max-w-[min(24rem,calc(100%-1.5rem))] items-start gap-2",
        "rounded-xl border border-white/12 bg-black/72 py-2.5 pl-3 pr-1.5 backdrop-blur-md",
        "shadow-[var(--shadow-e4)]",
        className,
      )}
    >
      {/* The signal line, the same gold the wall uses, one notch quieter. */}
      <span
        aria-hidden
        className="mt-1 h-3.5 w-[2px] shrink-0 rounded-full bg-signal"
      />
      <p className="text-[12px] leading-relaxed text-ink/90">
        {left === 1
          ? "Îți mai rămâne un minut din cele incluse astăzi. "
          : `Îți mai rămân ${left} minute din cele incluse astăzi. `}
        <Link
          href="/preturi"
          className="whitespace-nowrap text-signal-bright underline underline-offset-4 transition-colors duration-300 hover:text-signal"
        >
          Vezi planurile
        </Link>
      </p>
      <button
        type="button"
        onClick={close}
        aria-label="Închide"
        className="-mr-0.5 ml-auto grid size-6 shrink-0 place-items-center rounded-md text-ink-faint transition-colors duration-300 hover:bg-white/10 hover:text-ink"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
