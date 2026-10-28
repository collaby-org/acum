"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Search, X } from "lucide-react";
import { AcumMark } from "@/components/brand";
import { AccountButton } from "@/components/account/account-button";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

type HeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  favoritesCount: number;
  favoritesActive: boolean;
  onToggleFavorites: () => void;
};

export function Header({
  query,
  onQueryChange,
  favoritesCount,
  favoritesActive,
  onToggleFavorites,
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const account = useAccount();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        onQueryChange("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onQueryChange]);

  const expanded = focused || query.length > 0;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 ease-out",
        scrolled
          ? "border-b border-white/[0.08] bg-canvas/80 shadow-[0_20px_44px_-34px_rgba(0,0,0,1)] backdrop-blur-2xl backdrop-saturate-150"
          : "border-b border-transparent bg-gradient-to-b from-black/70 via-black/35 to-transparent",
      )}
    >
      {!scrolled && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-full h-10 bg-gradient-to-b from-black/45 to-transparent"
        />
      )}
      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-3 px-4 sm:h-[72px] sm:gap-5 sm:px-8 lg:px-12">
        {/* Wordmark — the front door for a visitor, the catalogue for a
            signed-in account: the landing page is not for somebody who
            already has an account. At the top of the catalogue when
            already there. Until the account has answered, the visitor's
            side is assumed. */}
        <a
          href={
            account.signedIn
              ? pathname === "/canale"
                ? "#top"
                : "/canale"
              : "/"
          }
          className="group flex shrink-0 items-center gap-3"
          aria-label={
            account.signedIn
              ? `${SITE_NAME} — catalog`
              : `${SITE_NAME} — începutul paginii`
          }
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_10px_26px_-14px_rgba(242,167,27,0.85)] transition-transform duration-500 ease-spring group-hover:scale-105">
            <AcumMark id="acum-mark-header" className="size-[21px]" />
          </span>
          <span className="font-display text-[19px] font-bold tracking-[0.16em] text-ink">
            {SITE_NAME}
          </span>
          <span className="hidden h-4 w-px bg-white/12 lg:block" />
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.22em] text-ink-faint lg:block">
            TV live · România
          </span>
        </a>

        <div className="flex-1" />

        {/* Nav links — visible when signed in */}
        {account.signedIn && (
          <nav aria-label="Principal" className="hidden md:flex items-center gap-1">
            <Link href="/canale" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:text-ink transition-colors">Catalog</Link>
            <Link href="/canale/toate" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:text-ink transition-colors">Toate canalele</Link>
          </nav>
        )}

        {/* Search */}
        <div
          className={cn(
            "group relative flex h-10 items-center gap-2 rounded-full border transition-[width,background-color,border-color,box-shadow] duration-500 ease-spring",
            "border-white/[0.08] bg-white/[0.04] backdrop-blur-xl",
            expanded
              ? "w-full max-w-md border-signal/45 bg-canvas/70 shadow-[0_0_0_4px_rgba(242,167,27,0.10),0_18px_40px_-22px_rgba(0,0,0,0.95)]"
              : "w-10 hover:border-white/20 hover:bg-white/[0.07] sm:w-60",
          )}
        >
          <Search
            className={cn(
              "ml-3.5 size-4 shrink-0 transition-colors duration-300",
              expanded ? "text-signal" : "text-ink-faint",
            )}
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Caută un canal…"
            aria-label="Caută un canal"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint placeholder:transition-colors placeholder:duration-300 focus:placeholder:text-ink-muted/60 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Șterge căutarea"
              className="mr-2 grid size-6 shrink-0 place-items-center rounded-full text-ink-faint transition duration-300 ease-spring hover:bg-white/10 hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="mr-3 hidden rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">
              ⌘K
            </kbd>
          )}
        </div>

        {/* The account: the way in, and what the plan is. */}
        <AccountButton />

        {/* Favourites */}
        <Button
          variant={favoritesActive ? "primary" : "secondary"}
          size="sm"
          onClick={onToggleFavorites}
          aria-pressed={favoritesActive}
          className={cn(
            "hidden shrink-0 gap-2 sm:inline-flex",
            "transition-[transform,box-shadow,background-color,color] duration-300 ease-spring",
            "hover:-translate-y-px",
            favoritesActive &&
              "shadow-[0_14px_38px_-14px_rgba(242,167,27,0.9)]",
          )}
        >
          <Heart
            className={cn(
              "size-4 transition-transform duration-500 ease-spring",
              favoritesActive && "scale-110 fill-current",
            )}
          />
          Favorite
          <span
            key={favoritesCount}
            className="animate-scale-in ml-0.5 grid min-w-[22px] place-items-center rounded-full bg-black/25 px-1.5 text-[11px] font-semibold tabular-nums"
          >
            {favoritesCount}
          </span>
        </Button>

        <span className="relative shrink-0 sm:hidden">
          <Button
            variant={favoritesActive ? "primary" : "secondary"}
            size="icon-sm"
            onClick={onToggleFavorites}
            aria-label={`Favorite (${favoritesCount})`}
            aria-pressed={favoritesActive}
          >
            <Heart
              className={cn(
                "size-4 transition-transform duration-500 ease-spring",
                favoritesActive && "scale-110 fill-current",
              )}
            />
          </Button>
          {favoritesCount > 0 && (
            <span
              key={favoritesCount}
              className="animate-scale-in absolute -right-1 -top-1 grid min-w-[17px] place-items-center rounded-full bg-signal px-1 text-[10px] font-bold tabular-nums text-signal-ink shadow-[0_4px_14px_-4px_rgba(242,167,27,0.95)]"
            >
              {favoritesCount}
            </span>
          )}
        </span>
      </div>
    </header>
  );
}
