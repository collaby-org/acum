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
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { accountToken, useAccount } from "@/hooks/use-account";
import {
  cadenceLabel,
  PLANS,
  type PlanDefinition,
  type Product,
} from "@/lib/supabase/plans";
import { formatRegionalPrice, useRegionalPricing } from "@/lib/pricing-client";
import { cn } from "@/lib/utils";

export type PlansGridProps = {
  /** The tight layout, for the landing page. */
  compact?: boolean;
  /** The plans to show; every plan by default. */
  plans?: PlanDefinition[];
  className?: string;
};

export function PlansGrid({ compact = false, plans = PLANS, className }: PlansGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} compact={compact} />
      ))}
    </div>
  );
}

export function PlanCard({
  plan,
  compact = false,
}: {
  plan: PlanDefinition;
  compact?: boolean;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = useAccount();
  // The visitor's own region: the server can only guess, so the card shows
  // the regional price as soon as the browser answers. Before that the
  // server's default (euro) is painted — the same first-paint tradeoff the
  // pricing hook documents.
  const { pricing } = useRegionalPricing();
  const free = plan.id === "free";
  // The plan's own tier: monthly → monthly, household → household, …
  const ownPrice = pricing[plan.id] ?? pricing.monthly;
  const product = plan.id as Product;

  const buttonLabel = account.ready && account.signedIn
    ? (free ? "Planul tău: Gratuit" : "Planul tău: " + (plan.id === "monthly" ? "Individual" : plan.id === "household" ? "Casă" : "Viață"))
    : (free ? "Creează un cont" : "Alege " + (plan.id === "monthly" ? "Individual" : plan.id === "household" ? "Casă" : "Viață"));
  const buttonHref = account.ready && account.signedIn ? "/conturi" : (free ? "/conturi?intent=register" : "/conturi?intent=plan&plan=" + product);

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

      <div className="flex items-start justify-between gap-3">
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
            symbol: ownPrice.symbol,
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
        {free ? (
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
