/**
 * The plan cards.
 *
 * The same cards on the landing page and on the pricing page, so the price
 * a visitor reads in the pitch is the price they are charged.
 *
 * The button does not decide whether the payment works: it asks
 * `/api/checkout`, and the route answers. When the payments are not
 * configured the answer says so, in words, under the button — the visitor
 * is never left with a button that does nothing.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { accountToken, useAccount } from "@/hooks/use-account";
import {
  cadenceLabel,
  PLANS,
  type Plan,
  type PlanDefinition,
  type Product,
} from "@/lib/supabase/plans";
import { formatRegionalPrice, useRegionalPricing } from "@/lib/pricing-client";
import type { PlanPricing, RegionCode } from "@/lib/pricing-client";
import { cn } from "@/lib/utils";

export type PlansGridProps = {
  /** The tight layout, for the landing page. */
  compact?: boolean;
  /** The plans to show; every plan by default. */
  plans?: PlanDefinition[];
  /** The region the server read off the geo header. When it is given the
   *  grid prices it directly; without it the browser's own region is
   *  resolved after the first paint. */
  region?: RegionCode;
  /**
   * True when the plan the account is already on is named on its card
   * instead of being offered again. The accounts page and the pricing page
   * want it: showing a Lifetime account a "take this plan" button is how a
   * paid visitor ends up wondering whether they paid for anything.
   *
   * The visitor's own plan is read from the account store rather than
   * passed in, so the grid is never told something the store does not
   * know.
   */
  showCurrentPlan?: boolean;
  className?: string;
};

export function PlansGrid({
  compact = false,
  plans = PLANS,
  region,
  showCurrentPlan = false,
  className,
}: PlansGridProps) {
  // The visitor's own region: the server can only guess, so the card shows
  // the regional price as soon as the browser answers. Before that the
  // server's default (euro) is painted — the same first-paint tradeoff the
  // pricing hook documents.
  const { pricing } = useRegionalPricing(region);

  // The plan the account is on, read from the one store that knows. Until
  // the store has answered it reads as "unknown" rather than "free", so a
  // Lifetime plan is never briefly marked as the free card.
  const account = useAccount();
  const currentPlan =
    showCurrentPlan && account.ready && account.signedIn ? account.plan : null;

  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          pricing={pricing}
          compact={compact}
          current={showCurrentPlan ? currentPlan : null}
        />
      ))}
    </div>
  );
}

export function PlanCard({
  plan,
  pricing,
  compact = false,
  current = null,
}: {
  plan: PlanDefinition;
  pricing: PlanPricing;
  compact?: boolean;
  /** The plan the account is on, when the caller wants it named. */
  current?: Plan | null;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The free plan is the one with the free bill — not the one whose price
  // happens to be zero in the region's table (every plan's free tier is
  // zero there by construction).
  const free = plan.id === "free";
  // The plan's own tier: monthly → monthly, household → household, …
  const ownPrice = pricing[plan.id as "free" | "monthly" | "household" | "lifetime"] ?? pricing.monthly;
  const product = plan.id as Product;
  // This card is the plan the account is on. `comp` is the desk's own, and
  // it holds the same promise a paid plan does, so it is named as the plan
  // rather than sent back to a shop it has no business in.
  const isCurrent = current === plan.id && plan.id !== "free";

  const buy = async () => {
    if (free) return;
    if (working) return;

    setWorking(true);
    setError(null);

    try {
      const token = await accountToken();
      if (!token) {
        setError(
          "Autentifică-te mai întâi, apoi alege planul.",
        );
        return;
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ product }),
        cache: "no-store",
      });

      const answer = (await response.json().catch(() => null)) as {
        url?: unknown;
        error?: unknown;
      } | null;

      if (typeof answer?.url === "string") {
        window.location.href = answer.url;
        return;
      }

      setError(
        typeof answer?.error === "string"
          ? answer.error
          : "Plata nu a putut fi pregătită. Încearcă din nou.",
      );
    } catch {
      setError("Nu am putut contacta serverul. Verifică conexiunea.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <article
      data-slot="plan-card"
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border p-5",
        "transition-[transform,box-shadow,border-color] duration-500 ease-spring",
        plan.featured
          ? "border-signal/35 bg-surface/80 shadow-[var(--shadow-glow)]"
          : "border-white/[0.08] bg-surface/50",
        !plan.featured && "hover:-translate-y-1 hover:border-white/20",
      )}
    >
      {plan.featured ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/70 to-transparent"
        />
      ) : null}

      {/* The badge row is a fixed height even when empty: a card that
          carries a "Recomandat" would otherwise start its price a line
          lower than its neighbours, and four prices in a row that do not
          line up read as a broken grid rather than a featured plan. */}
      <div className="flex min-h-6 items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
            {plan.name}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            {plan.tagline}
          </p>
        </div>
        {plan.featured ? (
          <Badge variant="signal" size="xs">
            <Sparkles className="size-3" aria-hidden />
            Recomandat
          </Badge>
        ) : null}
      </div>

      <div className="mt-5 flex items-baseline gap-2">
        {free ? (
          <p className="font-display text-[24px] font-bold leading-none tracking-[-0.03em] text-ink">
            Gratuit
          </p>
        ) : (
          <>
            <p className="font-display text-[30px] font-bold leading-none tracking-[-0.03em] text-ink">
              {formatRegionalPrice(ownPrice)}
            </p>
            <p className="text-[13px] text-ink-faint">{cadenceLabel(plan)}</p>
          </>
        )}
      </div>

      {plan.seats > 1 && !free ? (
        <p className="mt-2 text-[12px] text-ink-faint">
          {plan.seats} locuri · {formatRegionalPrice({
            amount: Math.round(ownPrice.amount / plan.seats),
            currency: ownPrice.currency,
            locale: ownPrice.locale,
          })} pe loc
          {plan.cadence === "month" ? " pe lună" : ""}
        </p>
      ) : null}

      <ul
        className={cn(
          "mt-5 space-y-2.5 text-[13px] leading-relaxed text-ink-muted",
          compact && "mt-4 space-y-2",
        )}
      >
        {plan.features.slice(0, compact ? 3 : plan.features.length).map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <span
              aria-hidden
              className="mt-[7px] size-1 shrink-0 rounded-full bg-signal/80"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* The button sits at the foot of the card, so the four cards line
          up however long their lists are. */}
      <div className="mt-auto pt-6">
        {isCurrent ? (
          /* The plan the account is already on. It is stated, not sold:
             an offer to buy what you already own reads as a bug, and a
             paid visitor is left wondering whether anything was charged.
             The desk's own comp plan is named too, because being told you
             are on it is the only reason it is not a mystery. */
          <p className="flex items-center justify-center gap-2 rounded-[var(--radius)] border border-signal/30 bg-signal/[0.08] px-3 py-2.5 text-[13px] font-semibold text-signal-bright">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {plan.id === "comp"
              ? "Planul tău, oferit de echipă"
              : "Planul tău"}
          </p>
        ) : free ? (
          <Button asChild variant="secondary" size="md" className="w-full">
            <Link href="/conturi?intent=register">
              Creează un cont
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button
            variant={plan.featured ? "primary" : "outline"}
            size="md"
            onClick={buy}
            disabled={working}
            className="w-full"
          >
            {working ? <Loader2 className="size-4 animate-spin" /> : null}
            Alege {plan.name}
          </Button>
        )}

        {error ? (
          <p
            role="alert"
            className="mt-2.5 rounded-lg border border-live/25 bg-live/10 px-3 py-2 text-[12px] leading-relaxed text-[#ffb3b8]"
          >
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}
