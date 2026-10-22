"use client";

/**
 * The page that broke.
 *
 * An error thrown while rendering a route lands here instead of on the
 * framework's own screen: the visitor gets ACUM's mark, one plain sentence
 * about what happened and the two ways out — try again, or go back to the
 * catalogue. The digest is kept in the note because it is the only thing that
 * ties this screen to the server's log.
 */
import Link from "next/link";
import { useEffect } from "react";
import { AcumMark } from "@/components/brand";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-6 py-24 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_12px_30px_-16px_rgba(242,167,27,0.85)]">
          <AcumMark id="acum-mark-error" className="size-7" />
        </span>
        <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">
          Ceva nu a mers
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Pagina nu a putut fi încărcată. Canalele sunt în continuare aici.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded-full bg-signal px-6 text-sm font-medium text-[#141005] transition hover:bg-signal-bright"
          >
            Reîncearcă
          </button>
          <Link
            href="/canale"
            className="inline-flex h-11 items-center rounded-full border border-white/12 px-6 text-sm text-ink transition hover:border-white/25 hover:bg-white/[0.04]"
          >
            Înapoi la canale
          </Link>
        </div>
      </div>
    </main>
  );
}
