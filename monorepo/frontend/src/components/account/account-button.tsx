/**
 * The account control.
 *
 * The header's way in: a sign-in for the visitor who has no account, and a
 * chip with the plan for the visitor who has one. The chip opens a small
 * panel — the plan, what is left of today's allowance, and the way out.
 *
 * It reads the account from the store, so it is the same state the player
 * and the pricing page see.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isAdmin } from "@/lib/admin-access";
import { LogOut, Ticket, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { planDefinition, type Plan } from "@/lib/supabase/plans";
import { cn } from "@/lib/utils";

/** The name a plan is shown under. */
function planLabel(plan: Plan): string {
  if (plan === "comp") return "Concediat";
  return planDefinition(plan).name;
}

/** A date, in Romanian, without the time. */
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

export function AccountButton({ className }: { className?: string }) {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // The panel closes when the visitor clicks away from it or presses escape.
  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Until the server has answered, the way in is shown: most visitors are
  // not signed in, and the chip replaces it the moment the server says
  // otherwise.
  if (!account.ready || !account.signedIn) {
    return (
      <Button
        asChild
        variant="secondary"
        size="sm"
        className={cn("shrink-0 gap-2", className)}
      >
        <Link href="/conturi">
          <UserRound className="size-4" aria-hidden />
          Intră
        </Link>
      </Button>
    );
  }

  const until = formatDate(account.planUntil);
  const left = account.remainingMinutes;
  // The minutes left, as a whole number nobody has to do arithmetic on.
  // A plan the desk has lifted the limit for has nothing to count down.
  const remaining = left === null ? null : Math.max(0, Math.ceil(left));
  const limited =
    account.plan === "free" && !account.bypass && remaining !== null;

  return (
    <div ref={wrapRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3",
          "text-[13px] font-medium text-ink backdrop-blur-md transition-colors duration-300",
          "hover:border-white/20 hover:bg-white/[0.09]",
        )}
      >
        <UserRound className="size-4 text-signal" aria-hidden />
        <span className="hidden sm:inline">{planLabel(account.plan)}</span>
        <span className="sr-only">Contul meu</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-72 rounded-2xl border border-white/10 bg-canvas-raised/95 p-4 shadow-[var(--shadow-e4)] backdrop-blur-2xl"
        >
          <p className="truncate text-[13px] font-medium text-ink">
            {account.email ?? "Contul meu"}
          </p>
          <p className="mt-1 text-[12px] text-ink-muted">
            Plan: {planLabel(account.plan)}
            {until ? ` · până la ${until}` : ""}
          </p>

          {limited ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] leading-relaxed text-ink-muted">
              {remaining > 0 ? (
                <>
                  <span>
                    Astăzi îți mai rămân {formatRemaining(remaining)}.
                  </span>
                  {remaining <= 60 ? (
                    <Link
                      href="/preturi"
                      onClick={() => setOpen(false)}
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
                    onClick={() => setOpen(false)}
                    className="font-medium text-signal-bright underline underline-offset-4 transition-colors duration-300 hover:text-signal"
                  >
                    Vezi planurile
                  </Link>
                </>
              )}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-ink-muted">
              Fără limită de timp.
            </p>
          )}

          <div className="fx-divider my-3" />

          <Link
            href="/preturi"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[13px] text-ink-muted transition-colors duration-300 hover:text-ink"
          >
            <Ticket className="size-4" aria-hidden />
            Planuri
          </Link>
          <Link
            href="/conturi"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[13px] text-ink-muted transition-colors duration-300 hover:text-ink"
          >
            <UserRound className="size-4" aria-hidden />
            Contul meu
          </Link>

          {isAdmin(account.email, account.plan) ? (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[13px] text-ink-muted transition-colors duration-300 hover:text-ink"
            >
              <span className="inline-block size-4 text-signal">◆</span>
              Panou de administrare
            </Link>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void account.signOut();
            }}
            className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-[13px] text-ink-muted transition-colors duration-300 hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            Deconectare
          </button>
        </div>
      ) : null}
    </div>
  );
}
