"use client";

import { useAccount } from "@/hooks/use-account";
import { TVDirectory, type TVDirectoryChannel, TVLandingPage } from "./tv-directory";

/**
 * Netflix-style TV gate: unsigned visitors get the landing page with
 * Sign In / Register options, signed-in visitors get the catalog.
 */
export function TVGate({
  channels,
  liveCount,
}: {
  channels: TVDirectoryChannel[];
  liveCount: number;
}) {
  const { ready, signedIn } = useAccount();

  if (!ready) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <p className="text-sm text-white/40">Se încarcă…</p>
      </div>
    );
  }

  if (!signedIn) return <TVLandingPage />;

  return <TVDirectory channels={channels} liveCount={liveCount} />;
}