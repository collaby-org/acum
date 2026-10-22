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
import { PLANS, freeHours } from "@/lib/supabase/plans";
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
  const individual = PLANS.find((plan) => plan.id === "monthly");
  const household = PLANS.find((plan) => plan.id === "household");
  const lifetime = PLANS.find((plan) => plan.id === "lifetime");

  return {
    title: "Planuri",
    description: `${freeHours()} ore pe zi, gratuit. Fără limită de timp de la ${individual ? formatPrice(individual.price ?? 0) : ""} pe lună, un plan de casă la ${household ? formatPrice(household.price ?? 0) : ""} și un plan de viață la ${lifetime ? formatPrice(lifetime.price ?? 0) : ""}, plătit o singură dată.`,
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
  const individual = PLANS.find((plan) => plan.id === "monthly");
  const household = PLANS.find((plan) => plan.id === "household");
  const lifetime = PLANS.find((plan) => plan.id === "lifetime");

  const perSeat =
    household && household.price
      ? household.price / household.seats
      : 0;
  const fourIndividuals =
    individual && individual.price ? individual.price * (household?.seats ?? 4) : 0;
  const months =
    lifetime && individual && individual.price && lifetime.price
      ? Math.round(lifetime.price / individual.price)
      : 0;

  return [
    {
      title: "Gratis, cât timp vrei tu",
      text: `${freeHours()} ore pe zi e destul ca să vezi ce rulează, și suficient ca să știi că nimic nu se pierde. Limita se resetează la miezul nopții, în România.`,
    },
    {
      title: `Fără limită, de la ${individual ? formatPrice(individual.price ?? 0) : ""}`,
      text: "Planul individual ia doar limita. Nimic altceva nu se schimbă: aceleași canale, același player, fără reclame.",
    },
    {
      title: `Toată casa, la ${household ? formatPrice(household.price ?? 0) : ""}`,
      text: `${household?.seats ?? 4} locuri, ${household?.seats ?? 4} ecrane, o singură plată. Un loc costă ${formatPrice(perSeat)} pe lună — ${household?.seats ?? 4} planuri individuale ar costa ${formatPrice(fourIndividuals)}.`,
    },
    {
      title: `O singură plată, la ${lifetime ? formatPrice(lifetime.price ?? 0) : ""}`,
      text: `Planul de viață nu se reînnoiește niciodată și prețul nu crește. Se amortizează în a ${months}-a lună a planului individual.`,
    },
  ];
}

const QUESTIONS = [
  {
    question: "Ce se întâmplă când se termină cele două ore?",
    answer:
      " apare peste imagine, cu planurile și un singur buton. Poți lua un plan atunci, sau aștepta resetarea de la miezul nopții.",
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
  // The page says whether the payments are ready, so it is rendered per
  // request. The key is the same one the checkout route reads; when it is
  // missing, the button explains it instead of failing quietly.
  await connection();

  const paymentsReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const individual = PLANS.find((plan) => plan.id === "monthly");
  const household = PLANS.find((plan) => plan.id === "household");
  const lifetime = PLANS.find((plan) => plan.id === "lifetime");
  const perSeat =
    household && household.price ? household.price / household.seats : 0;
  const fourIndividuals =
    individual && individual.price ? individual.price * (household?.seats ?? 4) : 0;

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

      <header className="mx-auto flex h-16 max-w-[1800px] items-center gap-4 px-4 sm:h-[72px] sm:px-8 lg:px-12">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3"
          aria-label={`${SITE_NAME} — catalogul`}
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_10px_26px_-14px_rgba(242,167,27,0.85)]">
            <AcumMark id="acum-mark-preturi" className="size-[21px]" />
          </span>
          <span className="font-display text-[19px] font-bold tracking-[0.16em] text-ink">
            {SITE_NAME}
          </span>
        </Link>

        <div className="flex-1" />

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden gap-2 sm:inline-flex"
        >
          <Link href="/">
            <ArrowLeft className="size-4" aria-hidden />
            Catalog
          </Link>
        </Button>

        <AccountButton />
      </header>

      <div className="mx-auto max-w-[1800px] px-4 pb-24 sm:px-8 lg:px-12">
        {/* The head */}
        <div className="max-w-2xl pt-10 sm:pt-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
            {SITE_TAGLINE}
          </p>
          <h1 className="mt-5 font-display text-[clamp(2.1rem,4.8vw,3.4rem)] font-bold leading-[1.05] tracking-[-0.035em] text-balance text-ink">
            Planuri simple, fără surprize.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            Fiecare plan înlătură o limită. Nimic nu se deschide în plus: aceleași
            canale, același player, fără reclame în niciunul dintre ele.
          </p>
        </div>

        {/* The notice, when the payments are not ready. */}
        {!paymentsReady ? (
          <p className="mt-9 flex max-w-3xl items-start gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-4 text-[13px] leading-relaxed text-ink-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
            <span>
              <span className="font-medium text-ink">
                Plățile nu sunt configurate încă.
              </span>{" "}
              Până când echipa le activează, contul gratuit rămâne complet
              disponibil: două ore pe zi, toate canalele, fără reclame. Un
              buton de plată îți va spune exact același lucru.
            </span>
          </p>
        ) : null}

        {/* The plans */}
        <PlansGrid className="mt-12" />

        {/* The logic behind the prices */}
        <section className="mt-24">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
              De ce aceste prețuri
            </p>
            <h2 className="mt-4 font-display text-[clamp(1.5rem,2.8vw,2.15rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-balance text-ink">
              Scara urcă în două sensuri: cât plătești și cât primești.
            </h2>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            {reasons().map((reason) => (
              <div
                key={reason.title}
                className="border-t border-white/[0.08] pt-5"
              >
                <h3 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
                  {reason.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
                  {reason.text}
                </p>
              </div>
            ))}
          </div>

          {individual && household && lifetime ? (
            <div className="mt-10 rounded-2xl border border-white/[0.08] bg-surface/40 p-5 text-[13px] leading-relaxed text-ink-muted sm:p-6">
              <p className="flex items-center gap-2 font-medium text-ink">
                <ShieldCheck className="size-4 text-signal" aria-hidden />
                Numerele, pe scurt
              </p>
              <p className="mt-3">
                Planul individual este{" "}
                <span className="text-ink">{formatPrice(individual.price ?? 0)}</span>{" "}
                pe lună. Planul de casă este{" "}
                <span className="text-ink">{formatPrice(household.price ?? 0)}</span>{" "}
                pe lună pentru {household.seats} locuri, adică{" "}
                <span className="text-ink">{formatPrice(perSeat)}</span> pe loc —
                {household.seats} planuri individuale ar costa{" "}
                <span className="text-ink">{formatPrice(fourIndividuals)}</span>.
                Planul de viață este{" "}
                <span className="text-ink">{formatPrice(lifetime.price ?? 0)}</span>{" "}
                o singură dată, fără reînnoiri, și nu se schimbă niciodată.
              </p>
            </div>
          ) : null}
        </section>

        {/* The questions */}
        <section className="mt-24 max-w-3xl">
          <h2 className="font-display text-[clamp(1.5rem,2.8vw,2.15rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
            Întrebări frecvente
          </h2>

          <div className="mt-8 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {QUESTIONS.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-ink marker:hidden">
                  {item.question}
                  <span
                    aria-hidden
                    className="text-lg leading-none text-signal transition-transform duration-300 ease-spring group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <EntrySection />
      </div>
    </main>
  );
}
