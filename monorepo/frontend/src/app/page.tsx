/**
 * The front door.
 *
 * The catalogue is the product, but the product now has an account and a
 * free tier, and this is the page that says so: a hero, a short pitch, the
 * plans and a way in.
 *
 * It is the same interface as the rest of the product — the same type, the
 * same surfaces, the same one accent colour. Nothing here shouts.
 */
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Radio, ShieldCheck, Users } from "lucide-react";
import { AcumMark } from "@/components/brand";
import { AccountButton } from "@/components/account/account-button";
import { AccountPanel } from "@/components/account/account-panel";
import { PlansGrid } from "@/components/account/plans-grid";
import { LandingGate } from "@/components/landing-gate";
import { Button } from "@/components/ui/button";
import { CHANNEL_COUNT } from "@/data/channels";
import { freeHours } from "@/lib/supabase/plans";
import {
  SITE_NAME,
  SITE_PROMISE,
  SITE_PROMISE_SHORT,
  SITE_TAGLINE,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Începe aici",
  description:
    "Toate canalele de televiziune live din România, într-un singur player. Fără reclame, cu ghidul programului și audiența live. Două ore pe zi, gratuit.",
};

/** The free tier's allowance, the way it is spoken. */
const FREE_HOURS_WORDS = freeHours();

/** The stills the hero is built from — what is on air, right now. */
const STILLS = [
  "/posters/pro-tv.jpg",
  "/posters/tvr-1.jpg",
  "/posters/hbo.jpg",
  "/posters/kanal-d.jpg",
  "/posters/national-tv.jpg",
  "/posters/antena-1.jpg",
];

const PROMISES = [
  {
    icon: ShieldCheck,
    title: SITE_PROMISE_SHORT,
    text: "Niciuna, niciodată, nici înainte, nici în pauză.",
  },
  {
    icon: Radio,
    title: "Un player care pornește",
    text: "Fluxuri verificate, rezervă automată între surse.",
  },
  {
    icon: Users,
    title: "Audiență măsurată",
    text: "Câți oameni se uită acum, numărați la proxy.",
  },
];

/**
 * The year in the footer.
 *
 * It is read once and cached, so the page can stay static while the value
 * still refreshes on the next cache lifetime instead of on every render.
 */
async function copyrightYear() {
  "use cache";
  return new Date().getFullYear();
}

export default async function LandingPage() {
  const year = await copyrightYear();

  return (
    <main className="relative isolate min-h-dvh bg-canvas">
      {/* A signed-in account has no business on the front door; the gate
          sends it to the catalogue as soon as the session is known. */}
      <LandingGate />

      {/* The light the page stands in. Screen-blended, so it stays
          luminous over the near-black surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            background: [
              "radial-gradient(52% 46% at 12% 4%, hsl(214 92% 60% / 0.26) 0%, transparent 70%)",
              "radial-gradient(46% 44% at 88% 10%, hsl(40 94% 56% / 0.20) 0%, transparent 70%)",
              "radial-gradient(60% 50% at 50% 100%, hsl(268 80% 56% / 0.12) 0%, transparent 72%)",
            ].join(", "),
          }}
        />
        <div className="fx-grain absolute inset-0 opacity-[0.04] mix-blend-overlay" />
      </div>

      <LandingBar />

      {/* The hero */}
      <section className="mx-auto max-w-[1800px] px-4 pb-20 pt-32 sm:px-8 sm:pt-40 lg:px-12">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-16">
          <div className="animate-fade-up">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
              {SITE_TAGLINE}
            </p>

            <h1 className="mt-5 font-display text-[clamp(2.4rem,5.6vw,4.4rem)] font-bold leading-[1.02] tracking-[-0.035em] text-balance">
              <span className="bg-gradient-to-b from-white to-white/[0.78] bg-clip-text text-transparent">
                {CHANNEL_COUNT} de canale live,
              </span>
              <br />
              <span className="text-ink-muted">într-un singur player.</span>
            </h1>

            <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-ink-muted">
              Ghidul programului, audiența live și fiecare canal românesc, în
              tr-un loc care chiar pornește. Fă-ți cont și privește{" "}
              {FREE_HOURS_WORDS} ore pe zi, gratuit și fără reclame.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href="/conturi?intent=register">
                  Începe gratuit
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/preturi">Vezi planurile</Link>
              </Button>
            </div>

            <ul className="mt-10 flex flex-wrap gap-2">
              {PROMISES.map(({ icon: Icon, title }) => (
                <li
                  key={title}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[12px] text-ink-muted backdrop-blur-md"
                >
                  <Icon aria-hidden className="size-3.5 text-signal/80" />
                  {title}
                </li>
              ))}
            </ul>
          </div>

          {/* The wall: what is on air, right now. */}
          <div className="animate-rise relative">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-canvas-raised shadow-[var(--shadow-e4)]">
              <div className="grid grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-3">
                {STILLS.map((still) => (
                  <div
                    key={still}
                    className="relative aspect-video overflow-hidden rounded-lg bg-surface-2"
                  >
                    <Image
                      src={still}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover"
                      unoptimized
                    />
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"
                    />
                  </div>
                ))}
              </div>

              {/* The live bar under the wall. */}
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-3">
                <span className="inline-flex items-center gap-2 text-[12px] font-medium text-ink-muted">
                  <span className="relative grid size-2 place-items-center">
                    <span className="absolute inset-0 rounded-full bg-live/60 blur-[6px]" />
                    <span className="relative size-2 rounded-full bg-live" />
                  </span>
                  {CHANNEL_COUNT} canale live acum
                </span>
                <Link
                  href="/canale"
                  className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted transition-colors duration-300 hover:text-ink"
                >
                  Deschide catalogul
                  <ArrowRight className="size-3.5 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* The light the wall throws on the page. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -bottom-10 -z-10 h-32 rounded-full opacity-70 mix-blend-screen"
              style={{
                background:
                  "radial-gradient(50% 60% at 50% 40%, rgba(242,167,27,0.28) 0%, transparent 72%)",
              }}
            />
          </div>
        </div>
      </section>

      {/* The pitch */}
      <section className="mx-auto max-w-[1800px] px-4 pb-20 sm:px-8 lg:px-12">
        <div className="fx-divider opacity-60" />
        <div className="grid gap-10 pt-14 md:grid-cols-3 md:gap-8">
          {PROMISES.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <span className="grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                <Icon className="size-4.5 text-signal" aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
                {title}
              </h2>
              <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-ink-muted">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* The plans */}
      <section id="planuri" className="mx-auto max-w-[1800px] px-4 pb-24 sm:px-8 lg:px-12">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
            Planuri
          </p>
          <h2 className="mt-4 font-display text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-balance text-ink">
            Începe cu {FREE_HOURS_WORDS} ore pe zi. Fără limită când vrei.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            Contul gratuit dă {FREE_HOURS_WORDS} ore de direct în fiecare zi,
            pe toate canalele. Planurile plătite iau limita și o iau pe a
            doua.
          </p>
        </div>

        <PlansGrid className="mt-10" />
      </section>

      {/* The way in */}
      <section id="cont" className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            className="absolute inset-0 mix-blend-screen"
            style={{
              background: [
                "radial-gradient(38% 60% at 22% 50%, hsl(214 92% 60% / 0.16) 0%, transparent 70%)",
                "radial-gradient(34% 56% at 78% 52%, hsl(40 94% 56% / 0.13) 0%, transparent 70%)",
              ].join(", "),
            }}
          />
        </div>

        <div className="mx-auto max-w-[1800px] px-4 pb-28 sm:px-8 lg:px-12">
          <div className="grid gap-12 rounded-2xl border border-white/[0.08] bg-canvas-raised/70 p-6 backdrop-blur-xl sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
            <div className="max-w-lg">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
                Contul tău
              </p>
              <h2 className="mt-4 font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance text-ink">
                {FREE_HOURS_WORDS} ore pe zi, fără reclame, fără card.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
                {SITE_PROMISE} Contul este gratuit și nu cere card. Cu el,
                limita zilnică se resetează singură în fiecare zi, iar ghidul
                programului și audiența live rămân deschise.
              </p>
              <p className="mt-6 text-[13px] text-ink-faint">
                {SITE_NAME} indexează adresele publice de încorporare.
                Canalele aparțin deținătorilor lor.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-surface/60 p-5 sm:p-6">
              {/* The same panel as the accounts page: the form when there
                  is no account, the account itself when there is one — a
                  signed-in visitor is never shown the form again. The way
                  on after signing in is the accounts page: on the accounts
                  page itself it is the way back here. */}
              <AccountPanel initialMode="register" next="/conturi" />
            </div>
          </div>
        </div>
      </section>

      {/* The end of the page. */}
      <footer className="border-t border-white/[0.06] bg-canvas-raised/50">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-8 text-[12px] text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>
            © {year} {SITE_NAME}. {SITE_TAGLINE}.
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="/canale"
              className="transition-colors duration-300 hover:text-ink"
            >
              Catalog
            </Link>
            <Link
              href="/preturi"
              className="transition-colors duration-300 hover:text-ink"
            >
              Planuri
            </Link>
            <Link
              href="/conturi"
              className="transition-colors duration-300 hover:text-ink"
            >
              Conturi
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/**
 * The bar at the top of the page.
 *
 * The catalogue keeps its own header; this one belongs to the front door,
 * so it carries the wordmark, the way in and the way back.
 */
function LandingBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-canvas/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-3 px-4 sm:h-[72px] sm:gap-6 sm:px-8 lg:px-12">
        <Link
          href="/canale"
          className="group flex shrink-0 items-center gap-3"
          aria-label={`${SITE_NAME} — catalogul`}
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_10px_26px_-14px_rgba(242,167,27,0.85)]">
            <AcumMark id="acum-mark-landing" className="size-[21px]" />
          </span>
          <span className="font-display text-[19px] font-bold tracking-[0.16em] text-ink">
            {SITE_NAME}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-[13px] text-ink-muted md:flex">
          <Link
            href="/canale"
            className="transition-colors duration-300 hover:text-ink"
          >
            Catalog
          </Link>
          <Link
            href="#planuri"
            className="transition-colors duration-300 hover:text-ink"
          >
            Planuri
          </Link>
          <Link
            href="#cont"
            className="transition-colors duration-300 hover:text-ink"
          >
            Cont
          </Link>
        </nav>

        <div className="flex-1" />

        <AccountButton />
      </div>
    </header>
  );
}
