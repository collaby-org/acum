"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type UpdateToastProps = {
  /** A newer service worker is installed and waiting for its turn. */
  updateReady: boolean;
  /** Hands the page over to the new version. */
  onUpdate: () => void;
};

/**
 * The update notice.
 *
 * A new service worker never takes over on its own: the user is told, and
 * the reload happens only when they accept it.
 */
export function UpdateToast({ updateReady, onUpdate }: UpdateToastProps) {
  if (!updateReady) return null;

  return (
    <div
      role="status"
      className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-signal/30 bg-canvas-raised/95 py-1.5 pl-4 pr-1.5 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.95)] backdrop-blur-xl"
    >
      <span className="text-[13px] text-ink">Versiune nouă disponibilă</span>
      <Button size="sm" variant="primary" onClick={onUpdate}>
        <RefreshCw className="size-3.5" aria-hidden />
        Reîncarcă
      </Button>
    </div>
  );
}
