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

/**
 * The Google mark.
 *
 * The provider's own four-colour G, drawn rather than fetched: a social
 * button that does not carry its brand is a button that looks broken, and
 * the guidelines that come with the logo ask for exactly this drawing.
 * The colours stay outside the product's palette on purpose — it is a
 * foreign mark on our button, not our own.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.26-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.32v3.12A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27a7.2 7.2 0 0 1 0-4.54V6.61H1.32a11.99 11.99 0 0 0 0 10.78l3.96-3.12Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.79l3.45-3.45C17.95 1.17 15.24 0 12 0A11.99 11.99 0 0 0 1.32 6.61l3.96 3.12C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

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

  /** The way in through the provider. The page leaves and does not come back to this call. */
  const google = async () => {
    if (working) return;

    setWorking(true);
    setError(null);

    try {
      await account.signInWithGoogle();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Ceva nu a mers. Încearcă din nou.",
      );
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

      {/* The other way in: the provider, for the visitor who would rather not type a password. */}
      <div className="flex items-center gap-3 pt-0.5">
        <div className="fx-divider flex-1" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
          sau
        </span>
        <div className="fx-divider flex-1" aria-hidden />
      </div>

      <Button
        type="button"
        variant="outline"
        size={compact ? "md" : "lg"}
        disabled={working}
        onClick={() => void google()}
        className="w-full gap-2.5"
      >
        <GoogleMark className="size-4 shrink-0" />
        Continuă cu Google
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
