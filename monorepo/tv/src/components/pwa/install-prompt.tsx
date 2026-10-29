"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/site";
import { useInstall, useStandalone } from "./use-pwa";

const DISMISS_KEY = "acum:install-dismissed";

/** Two weeks. Long enough to be forgotten, short enough to be asked again. */
const DISMISS_TTL = 14 * 24 * 60 * 60 * 1000;

/** How long the app waits before it offers installation. */
const DELAY = 4000;

function dismissedRecently() {
  try {
    const stamp = Number(window.localStorage.getItem(DISMISS_KEY));
    if (!stamp) return false;
    if (Date.now() - stamp > DISMISS_TTL) {
      window.localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Private mode, no storage — the prompt simply comes back.
  }
}

/** Which browser reports this as iOS: it uses the share sheet. */
function isIosLike() {
  const agent = window.navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(agent);
  // An iPad reports itself as a Mac since iPadOS 13; its touch count is
  // what gives it away.
  const iPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(agent);
  return iOS || iPadOS;
}

/**
 * Whether this is a phone or a tablet, whatever browser it carries.
 *
 * The install event is a Chromium favour that never reaches Safari, and it
 * can be missed even on Chrome when the page is slow to hydrate. So the
 * device, not the event, decides whether a recipe belongs on screen.
 */
function isMobileDevice() {
  const agent = window.navigator.userAgent;
  const handheld = /iPhone|iPad|iPod|Android/.test(agent);
  const iPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(agent);

  // A coarse pointer alone is not enough — a desktop with a touchscreen has
  // one. A finger *and* a small screen is what a phone is.
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 767px)").matches;

  return handheld || iPadOS || (coarse && narrow);
}

/** Which of the two browser menus carries "add to home screen". */
function manualRecipe() {
  return isIosLike() ? "ios" : "android";
}

/**
 * The install prompt.
 *
 * Chromium gets a real button — the browser's own install event, fired on
 * our schedule. A phone or a tablet that never got the event — Safari, or
 * Chrome when the page was too slow to catch it — gets the recipe for the
 * menu that does have it. Anyone who already installed the app sees
 * nothing.
 */
export function InstallPrompt() {
  const { canInstall, install } = useInstall();
  const standalone = useStandalone();
  const [ready, setReady] = useState(false);

  // The device decides once, from the user agent and the screen, while the
  // component renders. Nothing here waits for a network round trip.
  const device = useMemo(
    () =>
      typeof window === "undefined"
        ? { mobile: false, recipe: null as "ios" | "android" | null }
        : { mobile: isMobileDevice(), recipe: manualRecipe() },
    [],
  );

  // Safari belongs to the mobile path too — it is the one case where the
  // recipe is also the only option. On a desktop browser with no install
  // event there is nothing honest to offer, so the card stays away.
  const manual = device.mobile;

  useEffect(() => {
    if (standalone || dismissedRecently()) return;

    const timer = window.setTimeout(() => setReady(true), DELAY);
    return () => window.clearTimeout(timer);
  }, [standalone]);

  const dismiss = () => {
    rememberDismissal();
    setReady(false);
  };

  if (!ready || standalone) return null;
  // Nothing to offer: no install event and no share-sheet recipe.
  if (!canInstall && !manual) return null;

  return (
    <div className="pointer-events-auto w-full max-w-sm animate-fade-up rounded-2xl border border-white/10 bg-canvas-raised/95 p-4 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-signal-bright via-signal to-signal-deep text-[#141005] shadow-[0_10px_30px_-10px_rgba(240,165,0,0.9)]">
          <Download className="size-4" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold tracking-tight">
            Instalează {SITE_NAME}
          </p>
          {manual ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              {device.recipe === "ios"
                ? "În Safari, apasă butonul de partajare și apoi „Adaugă pe ecranul de pornire”."
                : "În meniul Chrome, alege „Instalează aplicația” sau „Adaugă pe ecranul principal”."}
            </p>
          ) : (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              Adaugă aplicația pe ecranul principal și pornește-o ca pe telefon,
              fără bara de adresă.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Nu instala acum"
          data-tv-focus=""
          className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-faint transition duration-200 hover:bg-white/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {manual ? (
          <Button size="sm" variant="secondary" onClick={dismiss} data-tv-focus="">
            <Share className="size-3.5" aria-hidden />
            Am înțeles
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => void install()} data-tv-focus="">
              Instalează
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss} data-tv-focus="">
              Nu, mulțumesc
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
