import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AcumMark } from "@/components/brand";
import { Footer } from "@/components/footer";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/**
 * The shell every page outside the app lives in.
 *
 * The app has its own bar — the one that carries the channel search and the
 * favourites count — and that bar belongs to the home page alone. A content
 * page gets a quieter one: the mark, the wordmark and the way back.
 */

const BAR_LINKS = [
  { label: "Toate canalele", href: "/canale/grupate" },
  { label: "Ghid TV", href: "/ghid" },
];

export function PageBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-canvas/80 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-4 px-4 sm:h-[72px] sm:px-8 lg:px-12">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3"
          aria-label={`${SITE_NAME} — pagina principală`}
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_10px_26px_-14px_rgba(242,167,27,0.85)] transition-transform duration-500 ease-spring group-hover:scale-105">
            <AcumMark id="acum-mark-page" className="size-[21px]" />
          </span>
          <span className="font-display text-[19px] font-bold tracking-[0.16em] text-ink">
            {SITE_NAME}
          </span>
        </Link>

        <span aria-hidden className="hidden h-4 w-px bg-white/12 lg:block" />
        <span className="hidden text-[10px] font-medium uppercase tracking-[0.22em] text-ink-faint lg:block">
          {SITE_TAGLINE}
        </span>

        <div className="flex-1" />

        <nav aria-label="Navigare principală" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {BAR_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-full px-3 py-1.5 text-[13px] text-ink-muted transition-colors duration-300 hover:bg-white/[0.06] hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          href="/canale/grupate"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3.5 text-[13px] font-medium text-ink transition-[transform,background-color,border-color] duration-300 ease-spring hover:-translate-y-px hover:border-signal/40 hover:bg-white/[0.09] sm:hidden"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          Canale
        </Link>
      </div>
    </header>
  );
}

export type PageShellProps = {
  children: React.ReactNode;
};

/**
 * The frame: the bar, the page, the footer.
 *
 * The footer is the same one the app ends on, so the site reads as one
 * product from the first page to the last.
 */
export function PageShell({ children }: PageShellProps) {
  return (
    <div id="top" className="flex min-h-screen flex-col">
      <PageBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
