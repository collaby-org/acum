/**
 * The paywall.
 *
 * A full-bleed panel over the picture: the visitor has reached the end of
 * what the free plan gives, and the way out is one clear action.
 *
 * It has two faces. A visitor who is not signed in is asked to sign in or
 * to make an account — the two hours a day start there. A visitor who has
 * spent the day's two hours is shown the plans, because the answer is not
 * another free hour but a plan.
 *
 * The panel never says where the stream comes from, how many feeds the
 * channel has or anything else about the source: the wall is about the
 * account, not about the picture.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignInForm, type AuthMode } from "@/components/account/sign-in-form";
import { PLANS } from "@/lib/supabase/plans";
import { formatRegionalPrice, useRegionalPricing } from "@/lib/pricing-client";
import { cn } from "@/lib/utils";

export type PaywallReason = "signed_out" | "allowance_spent";

export type PaywallProps = {
  /** True when the panel covers the picture. */
  visible: boolean;
  /** Which face of the wall is shown. */
  reason: PaywallReason | null;
  /** The minutes watched today, when the limit is what stopped the picture. */
  minutesWatchedToday?: number;
  /** The daily allowance, in minutes. */
  allowanceMinutes?: number | null;
  className?: string;
};

export function Paywall({
  visible,
  reason,
  minutesWatchedToday = 0,
  allowanceMinutes = 120,
  className,
}: PaywallProps) {
  const [mode, setMode] = useState<AuthMode>("register");
  const [formOpen, setFormOpen] = useState(false);

  if (!visible || !reason) return null;

  const spent = reason === "allowance_spent";

  return (
    <div
      data-slot="paywall"
      className={cn(
        "absolute inset-0 z-40 overflow-y-auto bg-black/[0.88] p-4 backdrop-blur-[3px]",
        // On a phone the picture is a thin strip; the wall takes the whole
        // screen instead, so the form is never cut in half.
        "max-sm:fixed max-sm:inset-0 max-sm:z-50",
        className,
      )}
    >
      <div className="flex min-h-full">
        <div className="mx-auto my-auto w-full max-w-md rounded-2xl border border-white/10 bg-canvas-raised/95 p-4 shadow-[var(--shadow-e4)] sm:p-6">
          {spent ? (
            <SpentPanel
              minutesWatchedToday={minutesWatchedToday}
              allowanceMinutes={allowanceMinutes}
            />
          ) : (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-signal/85">
                Acces
              </p>
              <h2 className="mt-2.5 font-display text-[19px] font-semibold leading-snug tracking-[-0.02em] text-ink">
                Fă-ți cont și privește
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                Două ore de direct în fiecare zi, gratuit, pe toate canalele.
                Fără reclame, fără întreruperi.
              </p>

              {formOpen ? (
                <div className="mt-5">
                  <SignInForm
                    initialMode={mode}
                    onModeChange={setMode}
                    compact
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-2 sm:mt-5 sm:space-y-3">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      setMode("register");
                      setFormOpen(true);
                    }}
                  >
                    Creează un cont
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setFormOpen(true);
                    }}
                    className="w-full text-center text-[13px] text-ink-muted underline-offset-4 transition-colors duration-300 hover:text-signal-bright hover:underline"
                  >
                    Ai deja cont? Autentifică-te
                  </button>
                </div>
              )}

              <p className="mt-4 hidden items-center gap-2 text-[12px] text-ink-faint sm:flex">
                <Clock className="size-3.5 shrink-0" aria-hidden />
                Limita de două ore se resetează în fiecare zi, la miezul
                nopții.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The wall for a visitor who has spent the day's free hours.
 *
 * The plans are named and priced, and there is one action: the pricing
 * page, where the purchase happens.
 */
function SpentPanel({
  minutesWatchedToday,
  allowanceMinutes,
}: {
  minutesWatchedToday: number;
  allowanceMinutes: number | null;
}) {
  // The region is read once, on the first client render — not on every
  // repaint of the wall, which sits over a picture that keeps playing.
  const { pricing } = useRegionalPricing();

  const hours = Math.round((allowanceMinutes ?? 120) / 60);

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-signal/85">
        Limita zilnică
      </p>
      <h2 className="mt-2.5 font-display text-[19px] font-semibold leading-snug tracking-[-0.02em] text-ink">
        Ai atins limita de azi
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        Planul gratuit dă {hours} ore pe zi
        {minutesWatchedToday > 0
          ? ` — azi ai văzut ${Math.round(minutesWatchedToday)} minute.`
          : "."}{" "}
        Ia un plan și privești fără limită, cât timp vrei.
      </p>

      <ul className="mt-4 space-y-2">
        {PLANS.filter((plan) => plan.id !== "free").map((plan) => (
          <li
            key={plan.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Lock className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
              <span className="truncate text-[13px] text-ink">{plan.name}</span>
              {plan.seats > 1 ? (
                <span className="shrink-0 text-[11px] text-ink-faint">
                  {plan.seats} locuri
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-display text-[13px] font-semibold text-ink">
              {formatRegionalPrice(pricing[plan.id as "free" | "monthly" | "household" | "lifetime"] ?? pricing.monthly)}
              {plan.cadence === "month" ? " / lună" : ""}
            </span>
          </li>
        ))}
      </ul>

      <Button asChild variant="primary" size="md" className="mt-5 w-full">
        <Link href="/preturi">
          Vezi planurile
          <ArrowRight className="size-4" />
        </Link>
      </Button>

      <p className="mt-3 text-center text-[12px] text-ink-faint">
        Limita gratuită se resetează la miezul nopții, în România.
      </p>
    </div>
  );
}
