/**
 * The accounts.
 *
 *   /conturi
 *
 * Where a visitor signs in or makes an account. Two forms, one page, and a
 * clear way back to the catalogue — the accounts are a side door, not a
 * detour.
 *
 * The page knows two things the rest of the product does not need: which
 * form was asked for (`?intent=register`) and where the visitor was going
 * when they were sent here (`?next=`). The address that comes back is
 * checked before it is followed: only a path inside this site is followed.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AcumMark } from "@/components/brand";
import { AccountPanel } from "@/components/account/account-panel";
import { freeHours } from "@/lib/supabase/plans";
import {
  SITE_NAME,
  SITE_PROMISE,
  SITE_TAGLINE,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Conturi",
  description:
    "Autentifică-te sau creează un cont ACUM. Două ore de televiziune live în fiecare zi, gratuit și fără reclame.",
};

/** The free tier's allowance, the way it is spoken. */
const FREE_HOURS = freeHours();

/**
 * The page is rendered per request: the form that opens depends on where
 * the visitor came from.
 */
export const instant = false;

type AccountsProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * A path inside this site, or the catalogue.
 *
 * Anything else — an absolute address, a protocol, a double slash — is
 * dropped: the address in the query string is written by whoever sent the
 * visitor here, and it must not be able to send them somewhere else. The
 * fallback is the catalogue, because the landing page is not for a
 * visitor who just signed in.
 */
function safeNext(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "/canale";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/canale";
  return raw;
}

export default async function AccountsPage({ searchParams }: AccountsProps) {
  await connection();

  const params = await searchParams;
  const intent = params.intent;
  const mode =
    (Array.isArray(intent) ? intent[0] : intent) === "register"
      ? "register"
      : "signin";
  const next = safeNext(params.next);
  const purchase = params.achizitie === "ok";

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
              "radial-gradient(46% 44% at 14% 8%, hsl(214 92% 60% / 0.22) 0%, transparent 70%)",
              "radial-gradient(40% 42% at 86% 14%, hsl(40 94% 56% / 0.16) 0%, transparent 70%)",
            ].join(", "),
          }}
        />
        <div className="fx-grain absolute inset-0 opacity-[0.04] mix-blend-overlay" />
      </div>

      {/* The bar: the wordmark and the way back. */}
      <header className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 sm:h-[72px] sm:px-8">
        <Link
          href="/canale"
          className="group flex shrink-0 items-center gap-3"
          aria-label={`${SITE_NAME} — catalogul`}
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_10px_26px_-14px_rgba(242,167,27,0.85)]">
            <AcumMark id="acum-mark-conturi" className="size-[21px]" />
          </span>
          <span className="font-display text-[19px] font-bold tracking-[0.16em] text-ink">
            {SITE_NAME}
          </span>
        </Link>

        <div className="flex-1" />

        <Link
          href="/canale"
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3.5 text-[13px] font-semibold text-ink backdrop-blur-md transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.1]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Înapoi la catalog
        </Link>
      </header>

      <div className="mx-auto grid max-w-[1120px] gap-12 px-4 pb-24 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-20">
        {/* The pitch */}
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
            {SITE_TAGLINE}
          </p>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.4vw,3.2rem)] font-bold leading-[1.06] tracking-[-0.035em] text-balance text-ink">
            Contul tău, {FREE_HOURS} ore pe zi.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            Contul gratuit nu cere card și nu cere plată. Cu el, poți privi{" "}
            {FREE_HOURS} ore de direct în fiecare zi, pe toate canalele,
            fără reclame. Limita se resetează singură, la miezul nopții.
          </p>

          {purchase ? (
            <p className="mt-7 flex items-start gap-2.5 rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-[13px] leading-relaxed text-signal-bright">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              Plata a ajuns la noi. Planul apare pe contul tău în câteva
              momente — reîmprospătează pagina dacă nu se vede imediat.
            </p>
          ) : null}

          <ul className="mt-9 space-y-3 text-[14px] text-ink-muted">
            <li className="flex gap-3">
              <span
                aria-hidden
                className="mt-[9px] size-1 shrink-0 rounded-full bg-signal/80"
              />
              Toate canalele, fără reclame și fără ecrane negre.
            </li>
            <li className="flex gap-3">
              <span
                aria-hidden
                className="mt-[9px] size-1 shrink-0 rounded-full bg-signal/80"
              />
              Ghidul programului și audiența live, cât timp ești conectat.
            </li>
            <li className="flex gap-3">
              <span
                aria-hidden
                className="mt-[9px] size-1 shrink-0 rounded-full bg-signal/80"
              />
              {SITE_PROMISE}
            </li>
          </ul>
        </div>

        {/* The form */}
        <div className="lg:pt-4">
          <div className="rounded-2xl border border-white/[0.08] bg-canvas-raised/80 p-5 shadow-[var(--shadow-e3)] backdrop-blur-xl sm:p-7">
            <AccountPanel initialMode={mode} next={next} />
          </div>

          <p className="mt-4 px-1 text-[12px] leading-relaxed text-ink-faint">
            Prin continuare, accepți ca {SITE_NAME} să păstreze contul tău
            și ora la care ai privit. Canalele aparțin deținătorilor lor.
          </p>
        </div>
      </div>
    </main>
  );
}
