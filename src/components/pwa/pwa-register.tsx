"use client";

import { InstallPrompt } from "./install-prompt";
import { OfflineBadge } from "./offline-badge";
import { PwaHead } from "./pwa-head";
import { UpdateToast } from "./update-toast";
import { useServiceWorker } from "./use-pwa";

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

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-start sm:px-6">
        <InstallPrompt />
        <UpdateToast updateReady={updateReady} onUpdate={applyUpdate} />
        <OfflineBadge />
      </div>
    </>
  );
}
