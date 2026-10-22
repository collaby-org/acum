"use client";

import { useAccount } from "@/hooks/use-account";
import { TVDirectory, type TVDirectoryChannel } from "./tv-directory";
import { TVLoginQR } from "./tv-login-qr";

/**
 * Netflix-style TV gate: unsigned visitors get the QR login screen,
 * signed-in visitors get the channel directory. Loading stays dark.
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

  if (!signedIn) return <TVLoginQR />;

  return <TVDirectory channels={channels} liveCount={liveCount} />;
}
