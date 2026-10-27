/**
 * The account panel.
 *
 * What the visitor sees on the accounts page: the form when there is no
 * account, and the account itself when there is one — the plan, what is
 * left of today's allowance, and the way out.
 */
"use client";

import Link from "next/link";
import { ArrowRight, LogOut, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignInForm, type AuthMode } from "@/components/account/sign-in-form";
import { useAccount } from "@/hooks/use-account";
import { planDefinition, type Plan } from "@/lib/supabase/plans";

/** The name a plan is shown under. */
function planLabel(plan: Plan): string {
  if (plan === "comp") return "Concediat de echipă";
  return planDefinition(plan).name;
}

/** A date, in Romanian. */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** The minutes left today, the way a person reads them. */
function formatRemaining(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function AccountPanel({
  initialMode = "signin",
  next = "/canale",
}: {
  initialMode?: AuthMode;
  next?: string;
}) {
  const account = useAccount();

  // Until the server has answered, the form is shown: most visitors are
  // here to make an account, and the panel replaces it the moment the
  // server says the visitor is already signed in.
  if (!account.ready || !account.signedIn) {
    return (
      <SignInForm
        initialMode={initialMode}
        onSuccess={() => {
          // The visitor came here to get somewhere; the catalogue is where
          // they were going.
          window.location.assign(next);
        }}
      />
    );
  }

  const until = formatDate(account.planUntil);
  const allowance = account.allowanceMinutes;
  const left = account.remainingMinutes;
  const used = account.minutesWatchedToday;
  // The minutes left, as a whole number nobody has to do arithmetic on.
  // A plan the desk has lifted the limit for has nothing to count down.
  const remaining = left === null ? null : Math.max(0, Math.ceil(left));
  const limited =
    account.plan === "free" && !account.bypass && remaining !== null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[15px] font-medium text-ink">
          {account.email ?? "Contul meu"}
        </p>
        <Badge variant="signal" size="xs">
          {planLabel(account.plan)}
        </Badge>
      </div>

      <dl className="mt-5 space-y-3 text-[13px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-faint">Plan</dt>
          <dd className="text-ink">{planLabel(account.plan)}</dd>
        </div>
        {until ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-faint">Active până la</dt>
            <dd className="text-ink">{until}</dd>
          </div>
        ) : null}
        {allowance !== null && left !== null ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-faint">Astăzi</dt>
            <dd className="text-ink">
              {used} din {allowance} minute
            </dd>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-faint">Timp</dt>
            <dd className="text-ink">Fără limită</dd>
          </div>
        )}
      </dl>

      {/* What is left of today, said plainly — and, when the day is nearly
          done, the way forward without going to look for it. */}
      {limited ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[12px] leading-relaxed text-ink-muted">
          {remaining > 0 ? (
            <>
              <span>Îți mai rămân {formatRemaining(remaining)} azi.</span>
              {remaining <= 60 ? (
                <Link
                  href="/preturi"
                  className="text-signal-bright underline underline-offset-4 transition-colors duration-300 hover:text-signal"
                >
                  Vezi planurile
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <span>Ai epuizat minutele incluse azi.</span>
              <Link
                href="/preturi"
                className="font-medium text-signal-bright underline underline-offset-4 transition-colors duration-300 hover:text-signal"
              >
                Vezi planurile
              </Link>
            </>
          )}
        </p>
      ) : null}

      <div className="fx-divider my-5" />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="primary" size="md" className="flex-1">
          <Link href="/preturi">
            <Ticket className="size-4" aria-hidden />
            Planuri
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={() => void account.signOut()}
        >
          <LogOut className="size-4" aria-hidden />
          Deconectare
        </Button>
      </div>
    </div>
  );
}
