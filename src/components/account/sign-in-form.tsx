/**
 * The sign-in form.
 *
 * Two forms in one: the visitor who has an account and the visitor who
 * does not. The same fields, the same place, one toggle between them — the
 * way every service asks for it, and the way the paywall needs it: the
 * picture is right there behind the panel, and the moment the visitor is
 * signed in it starts again.
 *
 * The messages are in Romanian; the provider answers in English, so the
 * known answers are translated before they are shown.
 */
"use client";

import { useState } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { cn } from "@/lib/utils";

export type AuthMode = "signin" | "register";

export type SignInFormProps = {
  /** Which form is shown first. */
  initialMode?: AuthMode;
  /** Called after a successful sign-in or registration. */
  onSuccess?: (mode: AuthMode) => void;
  /** Called when the visitor switches between the two forms. */
  onModeChange?: (mode: AuthMode) => void;
  /** The tight layout, for the paywall panel. */
  compact?: boolean;
  className?: string;
};

export function SignInForm({
  initialMode = "signin",
  onSuccess,
  onModeChange,
  compact = false,
  className,
}: SignInFormProps) {
  const account = useAccount();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const switchTo = (next: AuthMode) => {
    setMode(next);
    setError(null);
    onModeChange?.(next);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (working) return;

    setWorking(true);
    setError(null);

    try {
      if (mode === "register") {
        await account.signUp(email.trim(), password);
      } else {
        await account.signIn(email.trim(), password);
      }
      onSuccess?.(mode);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Ceva nu a mers. Încearcă din nou.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <form onSubmit={submit} className={cn("space-y-3", className)}>
      <div className="space-y-1.5">
        <label
          htmlFor="account-email"
          className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
        >
          Email
        </label>
        <input
          id="account-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nume@exemplu.ro"
          className={cn(
            "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-ink",
            "placeholder:text-ink-faint transition-colors duration-300",
            "hover:border-white/20 focus:border-signal/60 focus:outline-none focus:ring-2 focus:ring-signal/25",
          )}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="account-password"
          className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
        >
          Parolă
        </label>
        <input
          id="account-password"
          type="password"
          name="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
        size={compact ? "md" : "lg"}
        disabled={working}
        className="w-full"
      >
        {working ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === "register" ? (
          <UserPlus className="size-4" />
        ) : (
          <LogIn className="size-4" />
        )}
        {mode === "register" ? "Creează contul" : "Intră"}
      </Button>

      <div className="flex items-center justify-between gap-3 pt-0.5 text-[13px]">
        <button
          type="button"
          onClick={() => switchTo(mode === "register" ? "signin" : "register")}
          className="text-ink-muted underline-offset-4 transition-colors duration-300 hover:text-signal-bright hover:underline"
        >
          {mode === "register"
            ? "Ai deja cont? Autentifică-te"
            : "Nu ai cont? Creează unul"}
        </button>
        <span className="text-ink-faint">Fără reclame, niciodată.</span>
      </div>
    </form>
  );
}
