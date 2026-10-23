"use client";

import { useAccount } from "@/hooks/use-account";
import { TVDirectory, type TVDirectoryChannel } from "./tv-directory";

/**
 * Netflix-style TV gate: 
 * 1. Signed out → Landing page with Sign In / Register
 * 2. After auth → Profile picker ("Who's watching?")
 * 3. Profile selected → Netflix-style home with rows
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

  if (!signedIn) return <TVDirectory channels={channels} liveCount={liveCount} />;

  return <TVDirectory channels={channels} liveCount={liveCount} />;
}