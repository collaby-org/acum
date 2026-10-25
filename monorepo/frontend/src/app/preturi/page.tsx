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
import { ArrowLeft, Info, ShieldCheck } from "lucide-react";
import { AcumMark } from "@/components/brand";
import { AccountButton } from "@/components/account/account-button";
import { PlansGrid } from "@/components/account/plans-grid";
import { EntrySection } from "@/components/preturi/entry-section";
import { Button } from "@/components/ui/button";
import { PLANS, freeHours, getPlansWithRegionalPricing } from "@/lib/supabase/plans";
import {
  formatRegionalPrice,
  type CurrencyCode,
} from "@/lib/pricing";
import {
  formatPrice,
  SITE_NAME,
  SITE_PROMISE,
  SITE_TAGLINE,
} from "@/lib/site";

/**
 * The description is written from the prices themselves, so it cannot say
 * something the page does not.
 */
export async function generateMetadata(): Promise<Metadata> {
  const plans = getPlansWithRegionalPricing();
  
  const individual = plans.find((plan) => plan.id === "monthly");
  const household = plans.find((plan) => plan.id === "household");
  const lifetime = plans.find((plan) => plan.id === "lifetime");
  
  const individualPrice = individual?.regionalPrice?.monthly 
    ? `${formatRegionalPrice(individual.regionalPrice.monthly)}/lună`
    : "";
  const householdPrice = household?.regionalPrice?.monthly
    ? `${formatRegionalPrice(household.regionalPrice.monthly)}/lună`
    : "";
  const lifetimePrice = lifetime?.regionalPrice?.lifetime
    ? formatRegionalPrice(lifetime.regionalPrice.lifetime)
    : "";

  return {
    title: "Planuri",
    description: `${freeHours()} ore pe zi, gratuit. Fără limită de timp de la ${individualPrice}, un plan de casă la ${householdPrice} și un plan de viață la ${lifetimePrice}, plătit o singură dată.`,
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
 * The numbers are read from the plan catalogue, so the argument and the
 * price can never say different things.
 */
function reasons() {
  const plans = getPlansWithRegionalPricing();
  
  const individual = plans.find((plan) => plan.id === "monthly");
  const household = plans.find((plan) => plan.id === "household");
  const lifetime = plans.find((plan) => plan.id === "lifetime");

  const perSeat =
    household && household.regionalPrice?.monthly?.amount
      ? Math.round(household.regionalPrice.monthly.amount / household.seats)
      : 0;
  const fourIndividuals =
    individual && individual.regionalPrice?.monthly?.amount
      ? Math.round(individual.regionalPrice.monthly.amount * (household?.seats ?? 4) / 100)
      : 0;
  const months =
    lifetime && individual && individual.regionalPrice?.monthly?.amount && lifetime.regionalPrice?.lifetime?.amount
      ? Math.round(lifetime.regionalPrice.lifetime.amount / (individual.regionalPrice.monthly?.amount || 1))
      : 0;

  return [
    {
      title: "Gratis, cât timp vrei tu",
      text: `${freeHours()} ore pe zi e destul ca să vezi ce rulează, și suficient ca să știi că nimic nu se pierde. Limita se resetează la miezul nopții, în România.`,
    },
    {
      title: `Fără limită, de la ${individual?.regionalPrice?.monthly ? formatRegionalPrice(individual.regionalPrice.monthly) : ""}/lună`,
      text: "Planul individual ia doar limita. Nimic altceva nu se schimbă: aceleași canale, același player, fără reclame.",
    },
    {
      title: `Toată casa, la ${household?.regionalPrice?.monthly ? formatRegionalPrice(household.regionalPrice.monthly) : ""}/lună`,
      text: `${household?.seats ?? 4} locuri, ${household?.seats ?? 4} ecrane, o singură plată. Un loc costă ${formatRegionalPrice({
        amount: Math.round((household?.regionalPrice?.monthly?.amount ?? 0) / (household?.seats ?? 1)),
        currency: (household?.regionalPrice?.monthly?.currency ?? "EUR") as CurrencyCode,
        symbol: household?.regionalPrice?.monthly?.symbol ?? "€",
        locale: household?.regionalPrice?.monthly?.locale ?? "en-EU",
      })} pe lună — ${household?.seats ?? 4} planuri individuale ar costa ${formatRegionalPrice({
        amount: (individual?.regionalPrice?.monthly?.amount ?? 0) * (household?.seats ?? 4),
        currency: (individual?.regionalPrice?.monthly?.currency ?? "EUR") as CurrencyCode,
        symbol: individual?.regionalPrice?.monthly?.symbol ?? "€",
        locale: individual?.regionalPrice?.monthly?.locale ?? "en-EU",
      })}.`,
    },
    {
      title: `O singură plată, la ${lifetime?.regionalPrice?.lifetime ? formatRegionalPrice(lifetime.regionalPrice.lifetime) : ""}`,
      text: `Planul de viață nu se reînnoiește niciodată și prețul nu crește. Se amortizează în a ${months}-a lună a planului individual.`,
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
  const plans = getPlansWithRegionalPricing();
  
  const individual = plans.find((plan) => plan.id === "monthly");
  const household = plans.find((plan) => plan.id === "household");
  const lifetime = plans.find((plan) => plan.id === "lifetime");
  const perSeat =
    household && household.regionalPrice?.monthly?.amount
      ? Math.round(household.regionalPrice.monthly.amount / household.seats)
      : 0;
  const fourIndividuals =
    individual && individual.regionalPrice?.monthly?.amount
      ? Math.round(individual.regionalPrice.monthly.amount * (household?.seats ?? 4) / 100)
      : 0;

  return (
    <main className="relative isolate min-h-dvh bg-canvas">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
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

      <div
        aria-hidden
        className="fixed inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent"
      />

      <EntrySection
        individualPrice={individual?.regionalPrice?.monthly ? formatRegionalPrice(individual.regionalPrice.monthly) : ""}
        householdPrice={household?.regionalPrice?.monthly ? formatRegionalPrice(household.regionalPrice.monthly) : ""}
        lifetimePrice={lifetime?.regionalPrice?.lifetime ? formatRegionalPrice(lifetime.regionalPrice.lifetime) : ""}
        freeHours={freeHours()}
      />

      <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8 lg:px-12">
        <PlansGrid plans={PLANS} />

        <section className="mt-20" aria-labelledby="reasons-heading">
          <h2 id="reasons-heading" className="font-display text-3xl font-bold tracking-tight mb-12 text-center">
            De ce aceste prețuri
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {reasons().map((reason, index) => (
              <article
                key={reason.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 transition hover:border-white/20 hover:bg-white/10"
              >
                <h3 className="font-display text-xl font-semibold tracking-tight mb-4">{reason.title}</h3>
                <p className="text-white/70 leading-relaxed">{reason.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20" aria-labelledby="questions-heading">
          <h2 id="questions-heading" className="font-display text-3xl font-bold tracking-tight mb-12 text-center">
            Întrebări frecvente
          </h2>
          <dl className="space-y-6 max-w-3xl mx-auto">
            {QUESTIONS.map((qa, index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
                <dt className="font-semibold text-white mb-2">{qa.question}</dt>
                <dd className="text-white/70 leading-relaxed">{qa.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-20">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 sm:p-12 text-center">
            <h3 className="font-display text-2xl font-bold mb-4">
              Plățile nu sunt configurate încă
            </h3>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Când sunt active, butoanele de mai sus îți trimit direct la Stripe.
              Până atunci, poți testa interfața — butoanele îți explică ce fac.
            </p>
            <p className="text-sm text-white/40">
              Configurează STRIPE_SECRET_KEY și NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
              în variabilele de mediu pentru a activa plățile.
            </p>
          </div>
        </section>
      </main>
    </main>
  );
}