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

/** Safari on iOS has no install event, only the share sheet. */
function isIosSafari() {
  const agent = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(agent);
  const iPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(agent);
  const safari = /Safari/.test(agent) && !/CriOS|FxiOS|EdgiOS/.test(agent);
  return (iOS || iPadOS) && safari;
}

/**
 * The install prompt.
 *
 * Chromium gets a real button — the browser's own install event, fired on
 * our schedule. Safari gets the manual recipe, because that is all it has.
 * Anyone who already installed the app sees nothing.
 */
export function InstallPrompt() {
  const { canInstall, install } = useInstall();
  const standalone = useStandalone();
  const [ready, setReady] = useState(false);

  // Safari on iOS never fires the install event, so the recipe is read once,
  // from the user agent, while the component renders.
  const manual = useMemo(
    () => (typeof window === "undefined" ? false : isIosSafari()),
    [],
  );

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
              În Safari, apasă butonul de partajare și apoi „Adaugă pe ecranul
              principal”.
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
          className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-faint transition duration-200 hover:bg-white/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {manual ? (
          <Button size="sm" variant="secondary" onClick={dismiss}>
            <Share className="size-3.5" aria-hidden />
            Am înțeles
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => void install()}>
              Instalează
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Nu, mulțumesc
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
