"use client";

/**
 * The exchange itself.
 *
 * Only the success path lives here: the code, the tokens in the hash, the
 * session that the browser already holds. The refusal case is rendered on the
 * server by the page above, so a visitor whose sign-in was cancelled never
 * waits for a client bundle to find out.
 */
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

export function CallbackExchange() {
  useEffect(() => {
    const client = getSupabaseClient();
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    // The recovery flow lands with the token in the hash (access_token,
    // refresh_token, type=recovery). Continue to the reset page with the
    // credentials preserved, so the new password can be set.
    const hash = window.location.hash;
    if (hash && (hash.includes("access_token") || hash.includes("type=recovery"))) {
      window.location.replace(`/reset-password${hash}`);
      return;
    }

    // The clean address is the point: whatever was in it has been read,
    // and the accounts page must not carry it further.
    const finish = () => window.location.replace("/conturi");

    if (code) {
      // The auth-code flow lands with `?code=`; the exchange turns it
      // into a session, kept in storage like any other.
      void client.auth.exchangeCodeForSession(url.href).then(finish, finish);
      return;
    }

    // The implicit flow lands with the tokens in the hash. The client
    // reads them on its own (`detectSessionInUrl`); wait until the
    // session is there, then continue.
    void client.auth.getSession().then(finish, finish);
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas">
      <Loader2 className="size-6 animate-spin text-signal" aria-hidden />
      <span className="sr-only">Te autentificăm…</span>
    </main>
  );
}
