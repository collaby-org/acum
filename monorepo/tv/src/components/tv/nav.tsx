import Link from "next/link";
import { AcumMark } from "@/components/brand";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { TVFocusable } from "./focusable";

/**
 * The bar at the top of the television.
 *
 * It is not the website's header. The website's header answers to a
 * pointer: it has a growing search field, a favourites button with a
 * count, an account menu. None of that survives a five-button remote —
 * a text field on a television is a punishment, and an account menu a
 * dead end.
 *
 * So this one carries exactly what a remote can reach and use: the mark,
 * five destinations, and nothing else. It is glass over the live banner
 * behind it (`fx-glass-bar`, the navigation variant of the glass recipe),
 * fixed, and tall enough to clear the safe area of every panel.
 *
 * The D-pad's first press from the body lands on the first of these, so
 * the order is a decision: **Canale**, the product, before anything else.
 */

/** Where a remote goes when it wants the product, not the front door. */
const NAV_ITEMS = [
  { label: "Canale", href: "/canale" },
  { label: "Ghid", href: "/ghid" },
  { label: "Live", href: "/trending" },
  { label: "Meciuri", href: "/meciuri" },
  { label: "Cont", href: "/conturi" },
] as const;

export function TVNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] fx-glass-bar">
      <div
        className="mx-auto flex h-[var(--tv-nav-height)] max-w-[1800px] items-center gap-8 tv-safe-area"
        data-tv-nav="bar"
        data-tv-loop="x"
      >
        <Link
          href="/tv"
          className="flex shrink-0 items-center gap-3"
          aria-label={`${SITE_NAME} — prima pagină`}
        >
          <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_10px_26px_-14px_rgba(242,167,27,0.85)]">
            <AcumMark id="acum-mark-tv-nav" className="size-6" />
          </span>
          <span className="hidden font-display text-tv-caption font-bold tracking-[0.16em] text-ink sm:block">
            {SITE_NAME}
          </span>
        </Link>

        <span
          aria-hidden
          className="hidden h-5 w-px bg-white/12 lg:block"
        />
        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint lg:block">
          {SITE_TAGLINE}
        </span>

        <nav aria-label="Navigare principală">
          <ul className="flex items-center gap-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <TVFocusable
                  asChild
                  ring="soft"
                  className="inline-flex h-11 items-center rounded-full px-5 text-tv-caption font-medium text-ink-muted hover:bg-white/[0.06] hover:text-ink"
                >
                  <Link href={item.href}>{item.label}</Link>
                </TVFocusable>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
