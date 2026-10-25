/**
 * The bottom bar of the phone layout.
 *
 * Four tabs, always in the same place, always reachable — including inside
 * the installed app, where the browser's own chrome is gone and there is
 * no address bar to fall back on.
 *
 * The bar is decoration-free on purpose: it carries the four places the app
 * can go, and nothing else. What each tab does is decided by the caller —
 * on the catalogue the tabs move inside the page, on a channel they take
 * the visitor back to the catalogue. The defaults below are the catalogue
 * itself, so a caller that says nothing still lands somewhere sensible.
 */
"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart, House, LayoutGrid, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The four places the bar can point at. */
export type MobileNavAction = "home" | "categories" | "favorites" | "search";

export type MobileNavProps = {
  /** The tab that is open right now. `null` when none of them is. */
  active?: MobileNavAction | null;
  /** Goes to the catalogue. */
  onHome?: () => void;
  /** Goes to the category rails. */
  onCategories?: () => void;
  /** Goes to the favourites. */
  onFavorites?: () => void;
  /** Goes to the search. */
  onSearch?: () => void;
  className?: string;
};

/**
 * The bottom padding a page needs so that its content stops above the bar.
 *
 * The bar is 3.5rem tall plus the home indicator of the phone, so the page
 * adds that much room at the bottom.
 */
export const MOBILE_NAV_SPACE = "pb-[calc(4.5rem+env(safe-area-inset-bottom))]";

const TABS: { id: MobileNavAction; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Acasă", icon: House },
  { id: "categories", label: "Toate canalele", icon: LayoutGrid },
  { id: "favorites", label: "Favorite", icon: Heart },
  { id: "search", label: "Caută", icon: Search },
];

export function MobileNav({
  active = null,
  onHome,
  onCategories,
  onFavorites,
  onSearch,
  className,
}: MobileNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pendingSearch = useRef(false);

  // The search input belongs to the header of the catalogue. When the bar
  // is used from a page that has none, the visitor is sent to the
  // catalogue first and the input is focused once it is there.
  useEffect(() => {
    if (!pendingSearch.current) return;
    const input = document.querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) return;
    pendingSearch.current = false;
    input.focus();
    input.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pathname]);

  const focusSearch = () => {
    const input = document.querySelector<HTMLInputElement>('input[type="search"]');
    if (input) {
      input.focus();
      input.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    pendingSearch.current = true;
    router.push("/");
    window.setTimeout(() => {
      const late = document.querySelector<HTMLInputElement>('input[type="search"]');
      if (!late) return;
      pendingSearch.current = false;
      late.focus();
      late.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 700);
  };

  const actions: Record<MobileNavAction, () => void> = {
    home: () => (onHome ? onHome() : router.push("/")),
    categories: () =>
      onCategories ? onCategories() : router.push("/canale/toate"),
    favorites: () =>
      onFavorites ? onFavorites() : router.push("/?view=favorite"),
    search: () => (onSearch ? onSearch() : focusSearch()),
  };

  return (
    <nav
      aria-label="Navigare"
      data-slot="mobile-nav"
      className={cn(
        // Fixed to the bottom of the viewport, above the grain and above
        // the dialogs, so nothing can bury it.
        "fixed inset-x-0 bottom-0 z-[60] sm:hidden",
        "border-t border-white/10 fx-glass-bar",
        "px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={actions[tab.id]}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-2xl px-2 py-1.5",
                  "transition-colors duration-300 ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                  isActive ? "text-signal" : "text-ink-faint hover:text-ink",
                )}
              >
                <Icon
                  className={cn(
                    "size-5 transition-transform duration-300 ease-spring",
                    isActive && "scale-110",
                  )}
                  strokeWidth={isActive ? 2.3 : 2}
                  aria-hidden
                />
                <span className="text-[10px] font-semibold tracking-[0.08em]">
                  {tab.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
