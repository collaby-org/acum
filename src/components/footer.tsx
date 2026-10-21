import Link from "next/link";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CATEGORY_LINKS = [  { label: "Generaliste", href: "/#categorii" },
  { label: "Știri", href: "/#categorii" },
  { label: "Sport", href: "/#categorii" },
  { label: "Filme", href: "/#categorii" },
  { label: "Copii", href: "/#categorii" },
  { label: "Documentare", href: "/#categorii" },
  { label: "Muzică", href: "/#categorii" },
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
    <footer className="border-t border-white/8 bg-canvas-raised/60 px-4 py-14 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-md">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[10px] bg-signal text-[#141005]">
              <Play className="size-4 fill-current" />
            </span>
            <span className="font-display text-[19px] font-bold tracking-[0.16em]">
              VIZOR
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Un director de canale TV live construit din embed-urile publice de
            pe cool-etv.net. Fără cont, fără reclame, fără urmărire.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Categorii
            </h3>
            <ul className="space-y-2 text-ink-muted">
              {CATEGORY_LINKS.slice(0, 4).map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Mai mult
            </h3>
            <ul className="space-y-2 text-ink-muted">
              {CATEGORY_LINKS.slice(4).map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Produs
            </h3>
            <ul className="space-y-2 text-ink-muted">
              <li>Fără reclame</li>
              <li>Fără cont</li>
              <li>Favorite locale</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-[1800px] flex-col gap-3 border-t border-white/6 pt-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} VIZOR. Canalele aparțin deținătorilor
          lor; VIZOR indexează doar adresele publice de încorporare.
        </p>
        <Badge variant="outline" size="xs">
          Date verificate automat
        </Badge>
      </div>
    </footer>
  );
}
