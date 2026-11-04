"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/hooks/use-account";

/**
 * The front door's second half.
 *
 * The proxy sends a visitor with a live session straight to the
 * catalogue, before the landing page is painted. A visitor whose access
 * token has expired is left on the landing page instead: the cookie is
 * stale, but the browser still holds the refresh token, so the session
 * comes back on its own within a moment.
 *
 * This is where that moment ends. The visitor goes to the catalogue, and
 * the address is REPLACED rather than pushed — so the back button does not
 * walk them through the same door again, and the accounts page never opens
 * for someone who is signed in.
 */
export function SessionGate() {
  const { ready, signedIn } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (ready && signedIn) router.replace("/canale");
  }, [ready, signedIn, router]);

  return null;
}
