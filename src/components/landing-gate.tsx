/**
 * The landing gate.
 *
 * The front door belongs to the visitor without an account. Somebody who
 * is signed in has one already, and is sent straight to the catalogue the
 * moment the account answers — the gate renders nothing, so it never
 * shifts the page it guards.
 *
 * The session lives in the browser (storage + bearer token, no cookie the
 * server could read), so the decision is made client-side: the landing
 * paints first and the redirect follows. The brief flash is the cost of
 * no server session, and it is accepted.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/hooks/use-account";

export function LandingGate() {
  const router = useRouter();
  const account = useAccount();

  useEffect(() => {
    if (account.ready && account.signedIn) {
      router.replace("/canale");
    }
  }, [account.ready, account.signedIn, router]);

  return null;
}
