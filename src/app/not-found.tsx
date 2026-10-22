import Link from "next/link";
import { AcumMark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-24 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_12px_30px_-16px_rgba(242,167,27,0.85)]">
          <AcumMark id="acum-mark-404" className="size-7" />
        </span>
        <h1 className="mt-8 font-display text-5xl font-bold tracking-tight">404</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Pagina aceasta nu există. Canalele, în schimb, sunt aici.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-full bg-signal px-6 text-sm font-medium text-[#141005] transition hover:bg-signal-bright"
        >
          Înapoi la canale
        </Link>
      </div>
    </main>
  );
}
