/**
 * The desk's shell.
 *
 * A rail down the side with the four sections, a bar across the top with
 * the account that is signed in, and the content in between. The rail is
 * fixed and the content scrolls, so the owner never loses their place.
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AcumMark } from "@/components/brand";
import { AdminNav } from "@/components/admin/nav";
import { DeskIdentity } from "@/components/admin/identity";
import { SITE_NAME } from "@/lib/site";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      {/* The rail. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-white/[0.07] bg-canvas-raised/80 backdrop-blur-2xl lg:flex">
        <div className="flex h-[72px] items-center gap-3 border-b border-white/[0.06] px-6">
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_10px_26px_-14px_rgba(242,167,27,0.85)]">
            <AcumMark id="acum-mark-admin" className="size-[21px]" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[17px] font-bold tracking-[0.16em] text-ink">
              {SITE_NAME}
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">
              Panou
            </span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <AdminNav />
        </div>

        <div className="border-t border-white/[0.06] px-6 py-5">
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Acces intern. Nu se distribuie și nu se indexează.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-ink-muted transition-colors duration-300 hover:text-signal-bright"
          >
            Înapoi la aplicație
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        {/* The bar. */}
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-canvas/85 backdrop-blur-2xl">
          <div className="flex h-[72px] items-center gap-4 px-4 sm:px-8">
            <span className="flex items-center gap-2.5 lg:hidden">
              <span className="relative grid size-8 place-items-center overflow-hidden rounded-[10px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02]">
                <AcumMark id="acum-mark-admin-bar" className="size-[18px]" />
              </span>
              <span className="font-display text-[15px] font-bold tracking-[0.14em] text-ink">
                {SITE_NAME}
              </span>
            </span>

            <div className="hidden min-w-0 lg:block">
              <h1 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
                Panou de administrare
              </h1>
              <p className="text-[11px] text-ink-faint">
                Cifrele, conturile și mesajele — într-un loc.
              </p>
            </div>

            <div className="ml-auto">
              <DeskIdentity />
            </div>
          </div>

          <div className="border-t border-white/[0.05] px-4 py-2.5 sm:px-8">
            <AdminNav variant="bar" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1380px] px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
