"use client";

import { useEffect, useRef } from "react";
import { ACUM_MARK_PATH } from "@/components/brand";
import { SITE_NAME } from "@/lib/site";

/**
 * The ACUM intro.
 *
 * A sting, not a page. The mark draws itself in light, the wordmark
 * resolves under it, and the field lifts to leave the catalogue exactly as
 * it found it — two and a half seconds, once, on the device that has never
 * seen it.
 *
 * It is an overlay, never a route. The catalogue is rendered underneath it
 * from the first paint; the intro only decides whether it is seen. Nothing
 * here can delay the product, because the product is already there.
 */

/** Where the flag lives. Namespaced like the rest of the product's storage. */
const STORAGE_KEY = "acum:intro:v1";

/**
 * The beats, in milliseconds from the first paint.
 *
 * The stylesheet below is written from these numbers, so the sheet and the
 * timing can never drift apart.
 */
const BEAT = {
  /** The filament of light starts at the foot of the A. */
  draw: 120,
  /** The A is traced. */
  drawn: 900,
  /** The gold starts to fill the letter. */
  filled: 880,
  /** The letter is gold, and the playhead may leave it. */
  full: 1100,
  /** The playhead leaves the letter. */
  rail: 1100,
  railEnd: 1400,
  /** The wordmark resolves. */
  word: 1350,
  wordEnd: 1750,
  /** The light around the mark starts to swell. */
  bloom: 200,
  /** The swell settles. */
  bloomEnd: 2100,
  /** The field lifts. */
  exit: 2100,
  /** The catalogue is clear. */
  end: 2500,
} as const;

/** How long the whole sting lasts. */
const TOTAL_MS = BEAT.end;

/** How long the field takes to lift when the visitor ends it early. */
const SKIP_MS = 180;

/**
 * The length of the A's outline, in the mark's own units.
 *
 * The filament is drawn by hiding it behind a dash, and the dash has to be
 * as long as the letter or the letter is never finished. Chrome measures
 * `stroke-dasharray` in user units and ignores the `pathLength` attribute
 * for it, so the number is the path's real length — 290.03 — rounded up.
 */
const TRACE_LENGTH = 291;

/**
 * The sheet.
 *
 * The keyframes live here rather than in the global sheet: they belong to
 * this component and to nothing else. Everything else the product already
 * has — the ink, the gold, the curves, the grain, the bloom — is used as it
 * is.
 */
const CSS = `
/* The field. It covers the catalogue until the sting lifts. */
#acum-intro {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-canvas);
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  overscroll-behavior: contain;
}

/* The decision script below decides whether the field is ever seen. A
   visitor who has been here before never sees it — not even for a frame. */
#acum-intro[data-acum-intro="play"],
#acum-intro[data-acum-intro="skip"] {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
}

/* The lockup: the mark, and the name under it. */
.acum-intro-lockup {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
}
.acum-intro-markwrap {
  position: relative;
  display: grid;
  place-items: center;
}
.acum-intro-mark {
  display: block;
  width: 148px;
  height: 148px;
}
.acum-intro-bloom {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 230px;
  height: 230px;
  margin: -115px 0 0 -115px;
  mix-blend-mode: screen;
  pointer-events: none;
  --fx-bloom-color: rgb(242 167 27 / 0.62);
}
.acum-intro-word {
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.16em;
  color: var(--color-ink);
}

/* The filament of light that draws the letter, and the light it spills.
   The halo travels with the filament, so the light has a source and not a
   glow laid over a finished shape. */
.acum-intro-trace,
.acum-intro-halo {
  stroke-dasharray: ${TRACE_LENGTH};
  stroke-linecap: round;
  stroke-linejoin: round;
}
.acum-intro-halo {
  opacity: 0.6;
  filter: blur(4px);
}

/* The letter fills with gold behind the filament. */
.acum-intro-fill {
  opacity: 0;
}

/* The rail — the playhead — is drawn out from under the letter. It is the
   brand's own bar, scaled out of the letter's shadow. */
.acum-intro-rail {
  transform-box: fill-box;
  transform-origin: left center;
}

@keyframes acum-intro-draw {
  from { stroke-dashoffset: ${TRACE_LENGTH}; }
  to { stroke-dashoffset: 0; }
}
@keyframes acum-intro-fill {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes acum-intro-trace-rest {
  from { opacity: 1; }
  to { opacity: 0.24; }
}
@keyframes acum-intro-halo-rest {
  from { opacity: 0.6; }
  to { opacity: 0; }
}
@keyframes acum-intro-rail {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes acum-intro-bloom {
  0% { opacity: 0; transform: scale(0.3); }
  40% { opacity: 0.42; transform: scale(0.72); }
  78% { opacity: 1; transform: scale(1.08); }
  100% { opacity: 0.6; transform: scale(0.94); }
}
@keyframes acum-intro-out {
  /* The field lifts from wherever it is: a visitor who ends the sting
     during the last fade must not see it darken again first. */
  from { opacity: var(--acum-intro-now, 1); visibility: visible; }
  to { opacity: 0; visibility: hidden; }
}
@keyframes acum-intro-lift {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(1.07); }
}

.acum-intro-trace {
  animation:
    acum-intro-draw ${BEAT.drawn - BEAT.draw}ms var(--ease-in-out) ${BEAT.draw}ms both,
    acum-intro-trace-rest ${BEAT.railEnd - BEAT.drawn}ms var(--ease-out-expo) ${BEAT.drawn}ms forwards;
}
.acum-intro-halo {
  animation:
    acum-intro-draw ${BEAT.drawn - BEAT.draw}ms var(--ease-in-out) ${BEAT.draw}ms both,
    acum-intro-halo-rest ${BEAT.railEnd - BEAT.filled}ms var(--ease-out-expo) ${BEAT.filled}ms forwards;
}
.acum-intro-fill {
  animation: acum-intro-fill ${BEAT.full - BEAT.filled}ms var(--ease-out-expo) ${BEAT.filled}ms both;
}
.acum-intro-rail {
  animation: acum-intro-rail ${BEAT.railEnd - BEAT.rail}ms var(--ease-out-expo) ${BEAT.rail}ms both;
}
.acum-intro-bloom {
  animation: acum-intro-bloom ${BEAT.bloomEnd - BEAT.bloom}ms var(--ease-out-expo) ${BEAT.bloom}ms both;
}
/* The wordmark arrives with the product's own entrance. */
.acum-intro-word {
  animation: rise ${BEAT.wordEnd - BEAT.word}ms var(--ease-out-expo) ${BEAT.word}ms both;
}

/* The field lifts and the mark recedes: the catalogue is already there
   underneath, waiting. */
#acum-intro[data-acum-intro="play"] {
  animation: acum-intro-out ${BEAT.end - BEAT.exit}ms var(--ease-swift) ${BEAT.exit}ms forwards;
}
#acum-intro[data-acum-intro="play"] .acum-intro-lockup {
  animation: acum-intro-lift ${BEAT.end - BEAT.exit}ms var(--ease-swift) ${BEAT.exit}ms forwards;
}
/* A visitor who ends it early gets the product at once, not a slow fade. */
#acum-intro[data-acum-intro="skip"] {
  animation: acum-intro-out ${SKIP_MS}ms var(--ease-swift) forwards;
}
#acum-intro[data-acum-intro="skip"] .acum-intro-lockup {
  animation: acum-intro-lift ${SKIP_MS}ms var(--ease-swift) forwards;
}

@media (max-width: 480px) {
  .acum-intro-mark {
    width: 84px;
    height: 84px;
  }
  .acum-intro-word {
    font-size: 21px;
  }
  .acum-intro-lockup {
    gap: 20px;
  }
  .acum-intro-bloom {
    width: 140px;
    height: 140px;
    margin: -70px 0 0 -70px;
  }
}
`;

/**
 * The decision, taken before the first paint.
 *
 * It has to run before the browser paints, because the catalogue behind the
 * field must never flash. It is inline and it is first in the document, so
 * it runs while the page is still being parsed: a visitor who has been here
 * before is shown the catalogue straight away, and a visitor who has not is
 * shown the field instead — both from the very first frame.
 */
const DECISION = `
(function () {
  var field = document.getElementById("acum-intro");
  if (!field) return;
  var state = field.getAttribute("data-acum-intro");
  if (state && state !== "pending") return;
  try {
    /* Somebody who clicked a channel wants the channel. */
    if (location.pathname.indexOf("/canal/") === 0) {
      field.setAttribute("data-acum-intro", "away");
      return;
    }
    /* Reduced motion: the end state, immediately - which is the product. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      field.setAttribute("data-acum-intro", "still");
      return;
    }
    /* Installed: an app opened from the home screen is a first visit
       again, so the "seen" flag - the browser's own, and on iOS kept in a
       storage the installed app cannot reach - never keeps the sting down
       inside the app. It plays on every cold launch of the installed app
       and never on an in-app navigation: this script runs once per
       document, and the field never remounts. */
    var installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (
      !installed &&
      window.localStorage.getItem(${JSON.stringify(STORAGE_KEY)})
    ) {
      field.setAttribute("data-acum-intro", "seen");
      return;
    }
    field.setAttribute("data-acum-intro", "play");
    /* The field is a dialog while it is up, and it stops being one when it
       ends. The attribute is set here, before the first paint, because the
       screen reader must not find the catalogue behind a dialog that has
       not started yet. */
    field.setAttribute("aria-modal", "true");

    /* The page must not move under the field, and the visitor must never be
       held by it: a key press or a tap ends the sting at once. Both are
       wired here, before the first paint, so the sting answers from its very
       first frame - long before the page has finished hydrating. */
    var end = function () {
      if (!field.isConnected) return;
      if (field.getAttribute("data-acum-intro") !== "play") return;
      window.removeEventListener("keydown", end);
      field.removeEventListener("pointerdown", end);
      /* The field may already be lifting. It leaves from where it is, so
         ending it early never darkens the catalogue again. */
      var now = window.getComputedStyle(field).opacity;
      field.style.setProperty("--acum-intro-now", now);
      field.setAttribute("data-acum-intro", "skip");
      field.dispatchEvent(new CustomEvent("acum-intro-skip"));
    };
    window.addEventListener("keydown", end);
    field.addEventListener("pointerdown", end);
    field.addEventListener("wheel", function (e) { e.preventDefault(); }, { passive: false });
    field.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
  } catch (error) {
    /* Private mode, a blocked storage: the catalogue is the safe answer. */
    field.setAttribute("data-acum-intro", "seen");
  }
})();
`;

/** Why the intro is over, for whoever is listening. */
export type IntroFinishReason = "played" | "skipped";

export type FirstVisitIntroProps = {
  /**
   * Set false to keep the sting from playing on this mount. The shell uses
   * it to hold it back where the visitor has asked for something specific.
   */
  enabled?: boolean;
  /**
   * Called when the sting is over, however it ended. It is not called when
   * the sting never appeared.
   */
  onFinish?: (reason: IntroFinishReason) => void;
};

/** Remembers that the sting has been seen, on this device. */
function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode — the sting simply plays again next time */
  }
}

/**
 * True when the page is running as an installed app rather than in a
 * browser tab — any browser reporting standalone display mode, plus
 * iOS Safari's own flag. Inside the installed app the sting plays on
 * every cold launch: opening from the home screen is a first visit
 * again, and the *seen* flag — the browser's own, and on iOS kept in a
 * storage the installed app cannot reach — has no say in it.
 */
function isInstalled() {
  const query = window.matchMedia("(display-mode: standalone)");
  const legacy = window.navigator as Navigator & { standalone?: boolean };
  return query.matches || legacy.standalone === true;
}

/**
 * Locks the page under the field and puts the scrollbar's width back, so
 * the catalogue underneath does not shift sideways when the lock comes off.
 */
function lockScroll() {
  const root = document.documentElement;
  const body = document.body;
  const gap = window.innerWidth - root.clientWidth;
  const top = window.scrollY;
  let released = false;

  root.style.overflow = "hidden";
  if (gap > 0) body.style.paddingRight = `${gap}px`;

  return () => {
    if (released) return;
    released = true;
    root.style.overflow = "";
    body.style.paddingRight = "";
    if (window.scrollY !== top) window.scrollTo(0, top);
  };
}

/**
 * How much of the sting is left, read from the sheet itself.
 *
 * The animation starts at the first paint, which is before the browser has
 * finished hydrating. Asking the animation how far it has got is more
 * honest than counting from the moment the script happened to run.
 */
function timeLeft(element: Element | null, name: string, total: number) {
  const animation = element
    ?.getAnimations()
    .find((a) => (a as CSSAnimation).animationName === name);
  const current = animation?.currentTime as number | { value: number } | null;
  const elapsed =
    typeof current === "number"
      ? current
      : current && typeof current.value === "number"
        ? current.value
        : 0;
  return Math.max(0, total - elapsed);
}

export function FirstVisitIntro({
  enabled = true,
  onFinish,
}: FirstVisitIntroProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef(onFinish);

  /* The listener is registered once; the callback it calls is whatever the
     shell passed last. */
  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const field = fieldRef.current;
    const decision = field?.getAttribute("data-acum-intro") ?? "pending";

    /* The field is never re-rendered: the sheet hides it when the sting is
       over, and it stops being a dialog when the sting ends. A re-render
       here would put the field back on the screen for a frame. */
    const dismiss = () => field?.removeAttribute("aria-modal");

    /* The sheet decides before the first paint; this decides again, so the
       answer is the same on every route — including the ones whose layout
       arrives late. */

    /* Somebody who clicked a channel wants the channel. */
    if (!enabled || window.location.pathname.startsWith("/canal/")) {
      dismiss();
      return;
    }

    /* Reduced motion: the end state, at once — which is the product. It
       still counts as having been introduced: the visitor has the product,
       and the sting would only be in the way. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      markSeen();
      dismiss();
      return;
    }

    /* Already seen, on this device — except inside the installed app: a
       launch from the home screen is a first visit again, and the sting
       plays however many times the app has been opened. The sheet reached
       the same answer before the first paint, so the field is never shown
       and then taken away. */
    if (!isInstalled() && window.localStorage.getItem(STORAGE_KEY)) {
      dismiss();
      return;
    }

    /* The visitor ended it before the page had finished hydrating. */
    if (decision === "skip") {
      dismiss();
      finishRef.current?.("skipped");
      return;
    }

    /* The sheet never spoke — the page arrived without its layout. The
       product is already on screen, so the sting has nothing to say. */
    if (decision !== "play") {
      dismiss();
      return;
    }

    /* Written before the sting plays, so a reload halfway through does not
       start it again. */
    markSeen();

    const releaseScroll = lockScroll();
    const previous = document.activeElement as HTMLElement | null;
    field?.focus({ preventScroll: true });

    let ended = false;
    const end = (reason: IntroFinishReason) => {
      if (ended) return;
      ended = true;
      releaseScroll();
      dismiss();
      if (previous && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
      finishRef.current?.(reason);
    };

    /* The sheet below answers the tap and the key press from the first
       frame; this is the half that gives the page back when it does. */
    const onSkip = () => end("skipped");
    field?.addEventListener("acum-intro-skip", onSkip);

    const timer = window.setTimeout(
      () => end("played"),
      timeLeft(field, "acum-intro-out", TOTAL_MS),
    );

    return () => {
      window.clearTimeout(timer);
      field?.removeEventListener("acum-intro-skip", onSkip);
      releaseScroll();
    };
  }, [enabled]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        id="acum-intro"
        ref={fieldRef}
        data-acum-intro="pending"
        role="dialog"
        aria-label={SITE_NAME}
        tabIndex={-1}
      >
        <div className="acum-intro-lockup">
          <div className="acum-intro-markwrap">
            <div className="acum-intro-bloom fx-bloom" aria-hidden />
            <svg
              viewBox="0 0 100 100"
              className="acum-intro-mark"
              aria-hidden
              focusable="false"
            >
              <defs>
                <linearGradient id="acum-intro-gold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FFE7B0" />
                  <stop offset="0.38" stopColor="#F7B733" />
                  <stop offset="0.72" stopColor="#DE9206" />
                  <stop offset="1" stopColor="#9C6600" />
                </linearGradient>
                <linearGradient id="acum-intro-rail" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#D98F04" />
                  <stop offset="0.55" stopColor="#FFC95E" />
                  <stop offset="1" stopColor="#FFF3D4" />
                </linearGradient>
                <linearGradient id="acum-intro-trace" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FFF3D4" />
                  <stop offset="0.55" stopColor="#FFC95E" />
                  <stop offset="1" stopColor="#C87E00" />
                </linearGradient>
              </defs>
              {/* The playhead: it passes behind the letter and emerges. */}
              <rect
                className="acum-intro-rail"
                x="59"
                y="54"
                width="33"
                height="12"
                rx="6"
                fill="url(#acum-intro-rail)"
              />
              {/* The letter. */}
              <path
                className="acum-intro-fill"
                d={ACUM_MARK_PATH}
                fill="url(#acum-intro-gold)"
              />
              {/* The light that draws it, and the light it spills. */}
              <path
                className="acum-intro-halo"
                d={ACUM_MARK_PATH}
                fill="none"
                stroke="url(#acum-intro-trace)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="acum-intro-trace"
                d={ACUM_MARK_PATH}
                fill="none"
                stroke="url(#acum-intro-trace)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="acum-intro-word">{SITE_NAME}</span>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: DECISION }} />
    </>
  );
}
