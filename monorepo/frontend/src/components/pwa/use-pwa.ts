"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The `beforeinstallprompt` event is not part of the DOM types yet, so it is
 * described here. Chromium fires it when the app may be installed; Safari
 * never does, which is why the install prompt has a manual fallback.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

/* ------------------------------------------------------------------ *
 * The module-scope capture
 *
 * Chromium fires `beforeinstallprompt` as soon as the page is eligible —
 * which on a slow phone is often *before* React has hydrated. A listener
 * registered inside a `useEffect` misses it forever, and the app never
 * gets a second chance to be installed. So the listener goes up here, at
 * module scope: it is registered when this module evaluates, long before
 * any component renders, and the event is kept in a module-level variable
 * that every later mount can still read.
 * ------------------------------------------------------------------ */

/** The event, the moment the browser offered it — hydration or no hydration. */
let capturedPrompt: BeforeInstallPromptEvent | null = null;

/** Whether a capture is already spoken for. */
let captureArmed = false;

function onBeforeInstallPrompt(event: Event) {
  // Keep the browser's own mini-infobar out of the way.
  event.preventDefault();
  capturedPrompt = event as BeforeInstallPromptEvent;
  captureArmed = true;
}

// Registered once, at module evaluation. On the server there is no window,
// and on a fast desktop device the effect-based listener catches it anyway,
// so the `typeof` guard is what keeps this from crashing either way.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
}

/**
 * True when the app already runs from the home screen, in any browser.
 * Nothing install-related should be shown to someone who installed it.
 */
export function useStandalone() {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(display-mode: standalone)");
    const legacy = window.navigator as Navigator & { standalone?: boolean };

    const sync = () => setStandalone(query.matches || legacy.standalone === true);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return standalone;
}

/**
 * True while the browser reports a live connection. The signal is the OS
 * network interface, not the upstream — good enough to warn the user, not
 * good enough to promise a stream works.
 */
export function useOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(window.navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

/**
 * Captures the browser's install prompt so the app can offer installation in
 * its own rhythm, instead of whenever the browser feels like it.
 */
export function useInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    // Start from whatever the module listener already caught: on a slow
    // phone the event fires before this component ever mounts.
    capturedPrompt,
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // The module listener already called preventDefault; doing it twice
      // is harmless, and this path only runs when the event arrived after
      // hydration — the fast-desktop case.
      event.preventDefault();
      capturedPrompt = event as BeforeInstallPromptEvent;
      captureArmed = true;
      setPromptEvent(capturedPrompt);
    };

    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      // Installed is installed: the offer is spent.
      capturedPrompt = null;
      captureArmed = false;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return "unavailable" as const;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    // The prompt may be shown only once, whatever the answer was.
    capturedPrompt = null;
    captureArmed = false;
    return choice.outcome;
  }, [promptEvent]);

  return {
    /** The browser offered to install the app — before or after hydration. */
    canInstall: promptEvent !== null || captureArmed,
    installed,
    install,
  };
}

/**
 * Registers `/sw.js` and reports when a newer version is waiting to take
 * over. The new version is never activated behind the user's back: the
 * update toast asks first.
 */
export function useServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let disposed = false;

    const track = (active: ServiceWorkerRegistration) => {
      if (active.waiting && navigator.serviceWorker.controller) {
        setWaiting(active.waiting);
      }

      active.addEventListener("updatefound", () => {
        const installing = active.installing;
        if (!installing) return;

        installing.addEventListener("statechange", () => {
          // Installed, but an older worker is still in charge: that is an
          // update waiting for the user's say-so.
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setWaiting(installing);
          }
        });
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => {});
      }
    };

    const register = async () => {
      try {
        const active = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (disposed) return;
        registration = active;
        track(active);
        // A new version can land while the tab sits in the background.
        document.addEventListener("visibilitychange", onVisibility);
      } catch {
        // No service worker, no offline shell. The app still works.
      }
    };

    void register();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true },
    );
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, [waiting]);

  return { updateReady: waiting !== null, applyUpdate };
}
