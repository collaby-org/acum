import Link from "next/link";
import { ArrowUp, Radio, ShieldCheck, Sparkles } from "lucide-react";
import { AcumMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { SITE_NAME } from "@/lib/site";

const CATEGORY_LINKS = [
  { label: "Generaliste", href: "/#categorii" },
  { label: "Știri", href: "/#categorii" },
  { label: "Sport", href: "/#categorii" },
  { label: "Filme", href: "/#categorii" },
  { label: "Copii", href: "/#categorii" },
  { label: "Documentare", href: "/#categorii" },
  { label: "Muzică", href: "/#categorii" },
];

const PROMISES = [
  { icon: ShieldCheck, label: "Fără reclame" },
  { icon: Sparkles, label: "Fără cont" },
  { icon: Radio, label: "Favorite locale" },
];

/**
 * The copyright year is cached so the page can stay fully static while the
 * value still refreshes on the next cache lifetime instead of on every render.
 */
async function copyrightYear() {
  "use cache";
  return new Date().getFullYear();
}

export async function Footer() {
  const year = await copyrightYear();
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/[0.06] bg-canvas-raised/50">
      {/* The light from the page above spills into the footer. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,18,0)_0%,rgba(8,10,18,0.75)_38%,rgba(4,5,10,0.9)_100%)]" />
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            background: [
              "radial-gradient(46% 60% at 6% 6%, hsl(214 92% 62% / 0.3) 0%, transparent 68%)",
              "radial-gradient(40% 54% at 88% 2%, hsl(40 94% 58% / 0.26) 0%, transparent 68%)",
            ].join(", "),
          }}
        />
        <div className="fx-grain absolute inset-0 opacity-[0.045] mix-blend-overlay" />
      </div>

      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        <div className="fx-divider opacity-60" />

        <div className="grid gap-12 py-14 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-20 lg:py-20">
          {/* Statement */}
          <div className="max-w-lg">
            <div className="flex items-center gap-3">
              <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_10px_26px_-14px_rgba(242,167,27,0.85)]">
                <AcumMark id="acum-mark-footer" className="size-[21px]" />
              </span>
              <span className="font-display text-[19px] font-bold tracking-[0.16em]">
                {SITE_NAME}
              </span>
            </div>

            <p className="mt-6 font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-balance">
              Toate canalele românești,
              <br />
              <span className="text-ink-muted">
                pe un ecran care chiar pornește.
              </span>
            </p>

            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-muted">
              Un director de canale TV live, cu player propriu și fără reclame.
              Fără cont, fără urmărire — și fără ecran negru când apeși play.
            </p>

            <ul className="mt-7 flex flex-wrap gap-2">
              {PROMISES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[12px] text-ink-muted backdrop-blur-md"
                >
                  <Icon aria-hidden className="size-3.5 text-signal/80" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterColumn title="Categorii" links={CATEGORY_LINKS.slice(0, 4)} />
            <FooterColumn title="Mai mult" links={CATEGORY_LINKS.slice(4)} />
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                Produs
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
                <li>Verificare automată a datelor</li>
                <li>Calitate măsurată, nu estimată</li>
                <li>Rezervă automată între servere</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="fx-divider opacity-60" />

        <div className="flex flex-col gap-4 py-7 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE_NAME}. Canalele aparțin deținătorilor lor; {SITE_NAME}
            indexează doar adresele publice de încorporare.
          </p>
          <div className="flex items-center gap-3">
            <Badge variant="outline" size="xs">
              Date verificate automat
            </Badge>
            <a
              href="#top"
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 transition-[transform,color,border-color] duration-300 ease-spring hover:-translate-y-px hover:border-white/20 hover:text-ink"
            >
              <ArrowUp className="size-3 transition-transform duration-300 ease-spring group-hover:-translate-y-0.5" />
              Sus
            </a>
          </div>
        </div>
      </div>

      {/* The wordmark, once more, as a watermark the page ends on. */}
      <div
        aria-hidden
        className="pointer-events-none -mb-[0.14em] select-none overflow-hidden px-4 text-center font-display text-[clamp(64px,17vw,268px)] font-bold leading-[0.78] tracking-[-0.05em] text-white/[0.045] sm:px-8 lg:px-12"
      >
        {SITE_NAME}
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="group inline-flex items-center gap-1.5 transition-colors duration-300 hover:text-ink"
            >
              <span className="h-px w-0 bg-signal transition-[width] duration-300 ease-spring group-hover:w-3" />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
