/**
 * Who is at the desk.
 *
 * The account chip in the top bar: the e-mail that is signed in and the
 * plan it holds. The way out is here too — the desk is a place inside the
 * product, not a separate login.
 */
"use client";

import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import { planDefinition, type Plan } from "@/lib/supabase/plans";
import { cn } from "@/lib/utils";

function planLabel(plan: Plan): string {
  if (plan === "comp") return "Concediat";
  return planDefinition(plan).name;
}

export function DeskIdentity() {
  const account = useAccount();

  if (!account.ready) {
    return <span className="h-9 w-[150px] rounded-full bg-white/[0.04]" />;
  }

  if (!account.signedIn) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-ink-faint">
        <UserRound className="size-3.5" aria-hidden />
        Neconectat
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-ink-muted sm:inline-flex">
        <ShieldCheck className="size-3.5 text-signal" aria-hidden />
        {account.email ?? "contul de panou"}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-medium",
          account.plan === "comp" || account.bypass
            ? "border-signal/40 bg-signal/12 text-signal-bright"
            : "border-white/[0.08] bg-white/[0.03] text-ink-muted",
        )}
      >
        {planLabel(account.plan)}
      </span>
      <button
        type="button"
        onClick={() => void account.signOut()}
        className="grid size-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink"
        aria-label="Deconectare"
        title="Deconectare"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  );
}
