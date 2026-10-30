"use client";

import Link from "next/link";
import { useAccount } from "@/hooks/use-account";
import { planDefinition } from "@/lib/supabase/plans";
import { Button } from "@/components/ui/button";

export interface EntrySectionProps {
  individualPrice?: string;
  householdPrice?: string;
  lifetimePrice?: string;
  freeHours?: string;
}

export function EntrySection({
  individualPrice,
  householdPrice,
  lifetimePrice,
  freeHours = "două",
}: EntrySectionProps) {
  const { signedIn, plan, ready } = useAccount();

  // When signed in, show the plan indicator instead of the free-plan intro.
  if (ready && signedIn) {
    const label = plan === "comp" ? "Concediat de echipă" : planDefinition(plan).name;
    return (
      <section className="mt-24">
        <div className="rounded-2xl border border-white/[0.08] bg-canvas-raised/70 p-6 backdrop-blur-xl sm:p-10">
          <div className="max-w-xl">
            <h2 className="font-display text-[clamp(1.35rem,2.4vw,1.9rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-balance text-ink">
              Planul tău: {label}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
              Contul tău este activ. Poți schimba planul oricând din această pagină.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Not signed in: show the free-plan intro with pricing info.
  return (
    <section>
      <div className="flex flex-col items-start gap-6 rounded-2xl border border-white/[0.08] bg-canvas-raised/70 p-6 backdrop-blur-xl sm:p-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-[clamp(1.35rem,2.4vw,1.9rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-balance text-ink">
            Începe cu planul gratuit. {freeHours} ore, fără card.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            Contul se face într-un minut, iar limita se resetează singură în
            fiecare zi.
          </p>
          {individualPrice && (
            <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
              Planul individual: {individualPrice}/lună
            </p>
          )}
          {householdPrice && (
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
              Planul de casă: {householdPrice}/lună
            </p>
          )}
          {lifetimePrice && (
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
              Planul de viață: {lifetimePrice} (o singură dată)
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="primary" size="lg">
            <Link href="/conturi?intent=register">Creează un cont</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">Înapoi acasă</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
