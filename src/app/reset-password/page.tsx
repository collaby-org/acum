/**
 * Resetarea parolei.
 *
 * Două stări: vizitatorul care a primit linkul de recuperare (hash cu
 * tokenul de acces) și vizitatorul care vrea să solicite un link nou.
 * Copia este în română; nu există emoji.
 */
"use client";

import { useState, useEffect } from "react";
import { Loader2, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { getSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const recovery =
    typeof window !== "undefined" &&
    (window.location.hash.includes("access_token") ||
      window.location.hash.includes("type=recovery"));

  useEffect(() => {
    if (recovery) {
      // If the session comes through with the recovery hash, let Supabase
      // establish it so the update call has a bearer to use.
      void getSupabaseClient().auth.getSession();
    }
  }, [recovery]);

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      await account.resetPasswordForEmail(email.trim());
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Ceva nu a mers. Încearcă din nou.",
      );
    } finally {
      setWorking(false);
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (working) return;
    if (password !== confirm) {
      setError("Cele două parole nu se potrivesc.");
      return;
    }
    if (password.length < 6) {
      setError("Parola trebuie să aibă cel puțin 6 caractere.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const { error: err } = await getSupabaseClient().auth.updateUser({
        password,
      });
      if (err) throw new Error(err.message);
      setDone(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Ceva nu a mers. Încearcă din nou.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="min-h-dvh bg-canvas px-6 py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            {recovery ? "Parolă nouă" : "Recuperează parola"}
          </h1>
          <p className="mt-2 text-sm text-ink-muted leading-relaxed">
            {recovery
              ? "Alege o parolă nouă și continuă să vezi ACUM."
              : "Introdu emailul tău și îți trimitem un link pentru resetare."}
          </p>
        </div>

        <div
          className={cn(
            "rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20",
            "backdrop-blur-sm",
          )}
        >
          {done ? (
            <div className="text-center py-4">
              <KeyRound className="mx-auto size-10 text-signal mb-4" aria-hidden />
              <p className="text-ink font-medium">Parola a fost schimbată.</p>
              <p className="text-sm text-ink-muted mt-2">Te poți autentifica acum.</p>
              <a
                href="/conturi"
                className="mt-6 inline-block rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-ink hover:bg-signal-bright transition-colors"
              >
                Autentifică-te
              </a>
            </div>
          ) : recovery ? (
            <form onSubmit={submitReset} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="new-password"
                  className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
                >
                  Parolă nouă
                </label>
                <input
                  id="new-password"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-ink",
                    "placeholder:text-ink-faint transition-colors duration-300",
                    "hover:border-white/20 focus:border-signal/60 focus:outline-none focus:ring-2 focus:ring-signal/25",
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-password"
                  className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
                >
                  Confirmă parola
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  name="confirm"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-ink",
                    "placeholder:text-ink-faint transition-colors duration-300",
                    "hover:border-white/20 focus:border-signal/60 focus:outline-none focus:ring-2 focus:ring-signal/25",
                  )}
                />
              </div>
              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#ffb3b8]"
                >
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={working}
                className="w-full"
              >
                {working ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Salvează parola
              </Button>
            </form>
          ) : sent ? (
            <div className="text-center py-4">
              <Mail className="mx-auto size-10 text-signal mb-4" aria-hidden />
              <p className="text-ink font-medium">Link trimis.</p>
              <p className="text-sm text-ink-muted mt-2 leading-relaxed">
                Verifică inboxul. Linkul expiră în câteva ore și se folosește o singură dată.
              </p>
              <a
                href="/conturi"
                className="mt-6 inline-block rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-ink hover:bg-signal-bright transition-colors"
              >
                Înapoi la autentificare
              </a>
            </div>
          ) : (
            <form onSubmit={submitRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="reset-email"
                  className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
                >
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nume@exemplu.ro"
                  className={cn(
                    "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-ink",
                    "placeholder:text-ink-faint transition-colors duration-300",
                    "hover:border-white/20 focus:border-signal/60 focus:outline-none focus:ring-2 focus:ring-signal/25",
                  )}
                />
              </div>
              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#ffb3b8]"
                >
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={working}
                className="w-full"
              >
                {working ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mail className="size-4" />
                )}
                Trimite linkul
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
