/**
 * The phone side of the television link.
 *
 *   /tv-link?code=…
 *
 * A television shows a QR, the phone scans it and lands here. The page
 * does one thing: it puts the phone's session onto that code, so the
 * television can take it. Before sign-in there is nothing to hand over,
 * so the same form the accounts page uses is here first — and the
 * confirm button is only useful once the phone is signed in.
 *
 * The code is read from the address and never trusted on its own: an
 * unknown or expired code is refused by the bridge, not by this page.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, CheckCircle2, Tv } from "lucide-react";
import { AcumMark } from "@/components/brand";
import { TvLinkConfirm } from "@/components/tv-link-confirm";
import {
  SITE_NAME,
  SITE_PROMISE,
  SITE_TAGLINE,
} from "@/lib/site";
import { isTvCode } from "@/lib/tv-link";

export const metadata: Metadata = {
  title: "Conectează televizorul",
  description:
    "Scanează codul de pe televizor și conectează contul ACUM pe acel ecran.",
  robots: { index: false, follow: false },
};

type TvLinkProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The code from the address, when the address carries a usable one. */
function codeFrom(params: Record<string, string | string[] | undefined>) {
  const raw = Array.isArray(params.code) ? params.code[0] : params.code;
  return isTvCode(raw) ? raw : null;
}

/**
 * The page is rendered per request: the code lives in the address, and
 * the phone is often not signed in yet, so there is nothing to prerender.
 */
export const instant = false;

export default async function TvLinkPage({ searchParams }: TvLinkProps) {
  await connection();

  const params = await searchParams;
  const code = codeFrom(params);

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
              "radial-gradient(42% 40% at 86% 14%, hsl(40 94% 56% / 0.16) 0%, transparent 70%)",
            ].join(", "),
          }}
        />
        <div className="fx-grain absolute inset-0 opacity-[0.04] mix-blend-overlay" />
      </div>

      <header className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 sm:h-[72px] sm:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3"
          aria-label={`${SITE_NAME} — acasă`}
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_10px_26px_-14px_rgba(242,167,27,0.85)]">
            <AcumMark id="acum-mark-tv-link" className="size-[21px]" />
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
      </header>

      <div className="mx-auto max-w-[1120px] px-4 pb-24 pt-6 sm:px-8">
        <div className="mx-auto max-w-xl">
          <span className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02]">
            <Tv className="size-5 text-signal" aria-hidden />
          </span>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
            {SITE_TAGLINE}
          </p>

          <h1 className="mt-4 font-display text-[clamp(1.9rem,4vw,2.6rem)] font-bold leading-[1.08] tracking-[-0.03em] text-balance">
            Conectează televizorul
          </h1>

          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
            Ai scanat codul de pe televizor. Conectează-te, iar contul tău
            apare pe acel ecran — fără să scrii nimic pe telecomandă.{" "}
            {SITE_PROMISE}
          </p>

          {code ? (
            <div className="mt-8 rounded-2xl border border-white/[0.08] bg-canvas-raised/80 p-5 shadow-[var(--shadow-e3)] backdrop-blur-xl sm:p-7">
              <TvLinkConfirm code={code} />
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-white/[0.08] bg-canvas-raised/80 p-5 sm:p-7">
              <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
                Scanează codul de pe televizor ca să vinzi direct aici, cu
                codul deja completat.
              </p>
            </div>
          )}

          <p className="mt-6 text-[13px] text-ink-faint">
            Nu tu ai cerut legătura? Închide pagina — codul expiră în cinci
            minute și nu face nimic singur.
          </p>
        </div>
      </div>
    </main>
  );
}
