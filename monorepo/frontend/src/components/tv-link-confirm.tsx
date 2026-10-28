"use client";

/**
 * The phone's half of the handshake.
 *
 * It shows the account panel while the phone is not signed in — the same
 * form the accounts page uses, so there is one way to sign in anywhere in
 * the product — and the moment the phone holds a session it offers the
 * one thing this page exists for: hand it to the code in the address.
 *
 * The confirm itself is a `fetch` with the phone's own token, exactly the
 * way every other request the browser makes carries it.
 */

import { useState } from "react";
import { CheckCircle2, Loader2, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountPanel } from "@/components/account/account-panel";
import { accountToken, useAccount } from "@/hooks/use-account";

export type TvLinkConfirmProps = {
  /** The code from the address — the only thing the bridge will accept. */
  code: string;
};

export function TvLinkConfirm({ code }: TvLinkConfirmProps) {
  const account = useAccount();
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  // A phone that is not signed in has nothing to hand over: the form comes
  // first, and this whole half of the page is waiting behind it.
  if (!account.ready || !account.signedIn) {
    // Sign in and come back here, with the code still in the address —
    // the panel's `next` is a path inside this site, and this one is.
    return <AccountPanel initialMode="signin" next={`/tv-link?code=${code}`} />;
  }

  const confirm = async () => {
    setState("working");
    setMessage(null);

    const token = await accountToken();
    if (!token) {
      setState("failed");
      setMessage("Sesiunea nu a putut fi citită. Reîmprospătează pagina.");
      return;
    }

    try {
      const response = await fetch("/api/tv-link?confirm", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ code }),
        cache: "no-store",
      });

      const answer = (await response.json().catch(() => null)) as {
        message?: unknown;
      } | null;

      if (!response.ok) {
        setState("failed");
        setMessage(
          typeof answer?.message === "string"
            ? answer.message
            : "Codul nu a mai funcționat. Ia unul nou pe televizor.",
        );
        return;
      }

      setState("done");
    } catch {
      setState("failed");
      setMessage("Legătura cu serverul a eșuat. Încearcă din nou.");
    }
  };

  if (state === "done") {
    return (
      <div className="text-center" data-slot="tv-link-done">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-signal/12 text-signal">
          <CheckCircle2 className="size-5" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-[19px] font-semibold tracking-tight">
          Televizorul e conectat
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          Contul tău apare pe acel ecran. Poți închide pagina asta — ce
          urmează pe TV rămâne pe TV.
        </p>
      </div>
    );
  }

  return (
    <div data-slot="tv-link-confirm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-signal/85">
        Conectare
      </p>
      <h2 className="mt-2 font-display text-[19px] font-semibold tracking-tight">
        Autentifică televizorul
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        Contul {account.email} va fi conectat pe televizorul care a afișat
        codul. Poți deconecta televizorul oricând din cont.
      </p>

      <Button
        variant="primary"
        size="lg"
        className="mt-5 w-full gap-2.5"
        disabled={state === "working"}
        onClick={() => void confirm()}
      >
        {state === "working" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Tv className="size-4" aria-hidden />
        )}
        {state === "working" ? "Se conectează…" : "Conectează televizorul"}
      </Button>

      {message ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-muted"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
