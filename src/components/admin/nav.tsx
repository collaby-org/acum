/**
 * The desk's sections.
 *
 * Four of them, in the order the owner works in: the panel, the accounts,
 * the messages, the catalogue. The rail is the desk's spine — it is the
 * only thing that stays on screen while the content changes.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Tv, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/admin", label: "Panou", icon: LayoutDashboard, exact: true },
  { href: "/admin/conturi", label: "Conturi", icon: Users, exact: false },
  { href: "/admin/mesaje", label: "Mesaje", icon: MessageSquare, exact: false },
  { href: "/admin/catalog", label: "Catalog", icon: Tv, exact: false },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The sections, as a rail down the side or as a bar across the top. */
export function AdminNav({ variant = "rail" }: { variant?: "rail" | "bar" }) {
  const pathname = usePathname();

  if (variant === "bar") {
    return (
      <nav
        aria-label="Secțiunile panoului"
        className="flex gap-1.5 overflow-x-auto fx-hide-scrollbar lg:hidden"
      >
        {SECTIONS.map((section) => {
          const active = isActive(pathname, section.href, section.exact);
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors duration-300",
                active
                  ? "border-signal/40 bg-signal/12 text-signal-bright"
                  : "border-white/[0.07] bg-white/[0.03] text-ink-muted hover:border-white/15 hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {section.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Secțiunile panoului" className="flex flex-col gap-1">
      {SECTIONS.map((section) => {
        const active = isActive(pathname, section.href, section.exact);
        const Icon = section.icon;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors duration-300",
              active
                ? "text-signal-bright"
                : "text-ink-muted hover:bg-white/[0.04] hover:text-ink",
            )}
          >
            {/* The active section is lit from the left. */}
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full transition-all duration-300",
                active
                  ? "bg-signal opacity-100 shadow-[0_0_12px_rgba(242,167,27,0.9)]"
                  : "bg-white/20 opacity-0",
              )}
            />
            <Icon
              className={cn(
                "size-[18px] transition-colors duration-300",
                active ? "text-signal" : "text-ink-faint group-hover:text-ink-muted",
              )}
              aria-hidden
            />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
