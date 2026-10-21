"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "./use-pwa";

/**
 * A quiet note that the network is gone.
 *
 * Live TV cannot be replayed from a cache, so the honest thing to say is
 * that the connection is missing — not to pretend the app still works.
 */
export function OfflineBadge() {
  const online = useOnline();

  if (online) return null;

  return (
    <div
      role="status"
      className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-canvas-raised/95 px-3.5 py-2 text-[13px] text-ink-muted shadow-[0_18px_44px_-24px_rgba(0,0,0,0.95)] backdrop-blur-xl"
    >
      <WifiOff className="size-3.5 shrink-0 text-signal" aria-hidden />
      Fără conexiune — canalele live au nevoie de internet
    </div>
  );
}
