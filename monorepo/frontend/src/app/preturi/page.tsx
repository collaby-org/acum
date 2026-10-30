/**
 * The plans.
 *
 *   /preturi
 *
 * The prices, the reason behind them and the way to buy. When the payments
 * are not configured the page says so before anything is pressed — and the
 * button still answers, because a button that does nothing is worse than
 * a button that explains itself.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { AcumMark } from "@/components/brand";
import { AccountButton } from "@/components/account/account-button";
import { PlansGrid } from "@/components/account/plans-grid";
import { EntrySection } from "@/components/preturi/entry-section";
import { PLANS, freeHours } from "@/lib/supabase/plans";
import {
  formatRegionalPrice,
  getRegionalPricing,
  getRegionFromHeaders,
} from "@/lib/shared/pricing-utils";
import { SITE_NAME, SITE_PROMISE } from "@/lib/site";

/**
 * The description is written from the prices themselves, so it cannot say
 * something the page does not. It reads the visitor's region the same way
 * the page does — from the geo header — so a Romanian visitor is not
 * described prices in euros.
 */
export async function generateMetadata(): Promise<Metadata> {
  const pricing = getRegionalPricing(getRegionFromHeaders(await headers()));

  return {
    title: "Planuri",
    description: `${freeHours()} ore pe zi, gratuit. Fără limită de timp de la ${formatRegionalPrice(pricing.monthly)}/lună, un plan de casă la ${formatRegionalPrice(pricing.household)}/lună și un plan de viață la ${formatRegionalPrice(pricing.lifetime)}, plătit o singură dată.`,
  };
}

/**
 * The page is rendered per request: it says whether the payments are ready,
 * and that answer changes with the keys.
 */
export const instant = false;

/**
 * The reasons behind the prices, written from the prices themselves.
 *
 * The numbers are read from the same regional table the grid and the entry
 * section read, so the argument and the price can never say different
 * things. `seats` stays with the plan catalogue — it is the product's
 * shape, not the price.
 */
function reasons(pricing: ReturnType<typeof getRegionalPricing>) {
  const household = PLANS.find((plan) => plan.id === "household");
  const seats = household?.seats ?? 4;

  return [
    {
      title: "Gratis, cât timp vrei tu",
      text: `${freeHours()} ore pe zi e destul ca să vezi ce rulează, și suficient ca să știi că nimic nu se pierde. Limita se resetează la miezul nopții, în România.`,
    },
    {
      title: `Fără limită, de la ${formatRegionalPrice(pricing.monthly)}/lună`,
      text: "Planul individual ia doar limita. Nimic altceva nu se schimbă: aceleași canale, același player, fără reclame.",
    },
    {
      title: `Toată casa, la ${formatRegionalPrice(pricing.household)}/lună`,
      text: `${seats} locuri, ${seats} ecrane, o singură plată. Un loc costă ${formatRegionalPrice({
        amount: Math.round(pricing.household.amount / seats),
        currency: pricing.household.currency,
        locale: pricing.household.locale,
      })} pe lună — ${seats} planuri individuale ar costa ${formatRegionalPrice({
        amount: pricing.monthly.amount * seats,
        currency: pricing.monthly.currency,
        locale: pricing.monthly.locale,
      })}.`,
    },
    {
      title: `O singură plată, la ${formatRegionalPrice(pricing.lifetime)}`,
      text: `Planul de viață nu se reînnoiește niciodată și prețul nu crește. Se amortizează în a ${Math.max(1, Math.round(pricing.lifetime.amount / Math.max(1, pricing.monthly.amount)))}-a lună a planului individual.`,
    },
  ];
}

const QUESTIONS = [
  {
    question: "Ce se întâmplă când se termină cele două ore?",
    answer:
      "Apare peste imagine, cu planurile și un singur buton. Poți lua un plan atunci, sau aștepta resetarea de la miezul nopții.",
  },
  {
    question: "Pot anula planul plătit?",
    answer:
      "Da. Planurile lunare se anulează din cont, oricând, și rămân active până la sfârșitul perioadei plătite. Planul de viață nu se anulează — nu are de ce.",
  },
  {
    question: "Cum funcționează planul de casă?",
    answer:
      "O singură plată, patru locuri în aceeași casă. Fiecare persoană are contul ei și privește pe ecranul ei, în același timp.",
  },
  {
    question: "Există reclame?",
    answer: `Nu. ${SITE_PROMISE} Nu este o opțiune — streamurile vin prin proxy-ul nostru, fără scripturile și reclamele de la sursă.`,
  },
  {
    question: "Am nevoie de un plan ca să privesc?",
    answer:
      "Ai nevoie de un cont. Contul gratuit dă două ore pe zi. Dacă ai nevoie de mai mult pentru o echipă, scrie-ne și îți dăm acces.",
  },
];

export default async function PricingPage() {
  await connection();

  const paymentsReady = Boolean(process.env.STRIPE_SECRET_KEY);

  // The visitor's region, from the geo header the deployment sets. One
  // prime reading: the grid, the entry section and the reason cards all
  // prices the same currency, server-rendered.
  const region = getRegionFromHeaders(await headers());
  const pricing = getRegionalPricing(region);

  return (
    <div className="relative isolate min-h-dvh bg-canvas">
      <div
        aria-hidden
        className="pointer-events absolute inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            background: [
              "radial-gradient(48% 42% at 16% 4%, hsl(214 92% 60% / 0.22) 0%, transparent 70%)",
              "radial-gradient(42% 40% at 84% 12%, hsl(40 94% 56% / 0.18) 0%, transparent 70%)",
            ].join(", "),
          }}
        />
        <div className="fx-grain absolute inset-0 opacity-[0.04] mix-blend-overlay" />
      </div>

      {/* The bar: the wordmark, the way back and the account — the same
          shape as the accounts page, so the two side doors match. */}
      <header className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 sm:h-[72px] sm:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3"
          aria-label={`${SITE_NAME} — acasă`}
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_10px_26px_-14px_rgba(242,167,27,0.85)]">
            <AcumMark id="acum-mark-preturi" className="size-[21px]" />
          </span>
          <span className="font-display text-[19px] font-bold tracking-[0.16em] text-ink">
            {SITE_NAME}
          </span>
        </Link>

        <div className="flex-1" />

        <Link
          href="/"
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3.5 text-[13px] font-semibold text-ink backdrop-blur-md transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.1]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Înapoi acasă
        </Link>
        <AccountButton />
      </header>

      <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8 lg:px-12">
        {/* The plan the account is on is named on its card rather than
            offered again: a paid visitor checking the pricing page should
            read what they have, not be asked to buy it twice. */}
        <EntrySection
          individualPrice={formatRegionalPrice(pricing.monthly)}
          householdPrice={formatRegionalPrice(pricing.household)}
          lifetimePrice={formatRegionalPrice(pricing.lifetime)}
          freeHours={freeHours()}
        />

        <PlansGrid region={region} showCurrentPlan className="mt-8" />

        <section className="mt-16" aria-labelledby="reasons-heading">
          <h2 id="reasons-heading" className="font-display text-2xl font-bold tracking-tight mb-8 text-ink">
            De ce aceste prețuri
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {reasons(pricing).map((reason) => (
              <article
                key={reason.title}
                className="rounded-2xl border border-white/[0.08] bg-surface/50 p-6 sm:p-8 transition hover:border-white/20 hover:bg-white/10"
              >
                <h3 className="font-display text-xl font-semibold tracking-tight mb-4">{reason.title}</h3>
                <p className="text-white/70 leading-relaxed">{reason.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16" aria-labelledby="questions-heading">
          <h2 id="questions-heading" className="font-display text-2xl font-bold tracking-tight mb-8 text-ink">
            Întrebări frecvente
          </h2>
          <dl className="space-y-6 max-w-3xl mx-auto">
            {QUESTIONS.map((qa) => (
              <div key={qa.question} className="rounded-2xl border border-white/[0.08] bg-surface/50 p-6 sm:p-8">
                <dt className="font-semibold text-white mb-2">{qa.question}</dt>
                <dd className="text-white/70 leading-relaxed">{qa.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        {!paymentsReady ? (
          <section className="mt-20">
            <div className="rounded-2xl border border-white/[0.08] bg-surface/50 p-8 sm:p-12 text-center">
              <h3 className="font-display text-2xl font-bold mb-4">
                Plățile nu sunt configurate încă
              </h3>
              <p className="text-white/60 mb-8 max-w-xl mx-auto">
                Când sunt active, butoanele de mai sus îți trimit direct la
                plată. Până atunci, poți testa interfața — butoanele îți
                explică ce fac.
              </p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
