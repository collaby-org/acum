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
    null,
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Keep the browser's own mini-infobar out of the way.
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
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
    return choice.outcome;
  }, [promptEvent]);

  return {
    /** The browser offered to install the app. */
    canInstall: promptEvent !== null,
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
