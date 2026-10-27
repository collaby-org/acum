"use client";

import { InstallPrompt } from "./install-prompt";
import { OfflineBadge } from "./offline-badge";
import { PwaHead } from "./pwa-head";
import { UpdateToast } from "./update-toast";
import { useServiceWorker } from "./use-pwa";
import { MOBILE_NAV_SPACE } from "@/components/mobile-nav";
import { cn } from "@/lib/utils";

type PwaRegisterProps = {
  /**
   * Whether the manifest link and the PWA meta tags are rendered.
   *
   * They are hoisted into `<head>` by React, so the layout does not need to
   * carry them. Set this to `false` only if the head tags are declared in
   * `src/app/layout.tsx` instead — two manifest links would be a bug.
   */
  head?: boolean;
};

/**
 * The PWA shell.
 *
 * One component, one line in the root layout: it renders the head tags,
 * registers `/sw.js` and renders the three things the app owes the user —
 * the install prompt, the notice that a new version is waiting, and the
 * offline badge.
 *
 * ```tsx
 * <body>
 *   {children}
 *   <PwaRegister />
 * </body>
 * ```
 */
export function PwaRegister({ head = true }: PwaRegisterProps = {}) {
  const { updateReady, applyUpdate } = useServiceWorker();

  return (
    <>
      {head && <PwaHead />}

      {/* The prompt sits above the bottom bar of the phone layout, not under
          it: the bar is fixed at z-[60] and the grain overlay at z-[45]
          covers the viewport, so the container itself has to out-stack both
          or its card is painted over them. The bar is also cleared by
          MOBILE_NAV_SPACE, so nothing overlaps it either. */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-[61] flex flex-col items-center gap-2.5 px-4",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
          "sm:items-start sm:px-6 sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
          MOBILE_NAV_SPACE,
        )}
      >
        <InstallPrompt />
        <UpdateToast updateReady={updateReady} onUpdate={applyUpdate} />
        <OfflineBadge />
      </div>
    </>
  );
}
