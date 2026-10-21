"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Search, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-b border-white/8 bg-canvas/85 backdrop-blur-xl"
          : "border-b border-transparent bg-gradient-to-b from-black/70 to-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-3 px-4 sm:h-[72px] sm:gap-5 sm:px-8 lg:px-12">
        {/* Wordmark */}
        <a
          href="#top"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label="VIZOR — începutul paginii"
        >
          <span className="relative grid size-8 place-items-center rounded-[10px] bg-signal text-[#141005] shadow-[0_6px_20px_-6px_rgba(240,165,0,0.9)] transition-transform duration-300 group-hover:scale-105">
            <Tv className="size-4.5" />
          </span>
          <span className="font-display text-[19px] font-bold tracking-[0.16em] text-ink">
            VIZOR
          </span>
        </a>

        <div className="flex-1" />

        {/* Search */}
        <div
          className={cn(
            "flex h-10 items-center gap-2 rounded-full border transition-[width,background-color,border-color] duration-300",
            focused || query
              ? "w-full max-w-sm border-white/20 bg-white/8 sm:w-72"
              : "w-10 border-transparent bg-white/6 sm:w-56 sm:hover:border-white/15",
          )}
        >
          <Search
            className="ml-3.5 size-4 shrink-0 text-ink-faint"
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
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Șterge căutarea"
              className="mr-2 grid size-6 place-items-center rounded-full text-ink-faint transition hover:bg-white/10 hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="mr-3 hidden rounded border border-white/12 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Favourites */}
        <Button
          variant={favoritesActive ? "primary" : "secondary"}
          size="sm"
          onClick={onToggleFavorites}
          aria-pressed={favoritesActive}
          className="hidden shrink-0 sm:inline-flex"
        >
          <Heart className={cn("size-4", favoritesActive && "fill-current")} />
          Favorite
          {favoritesCount > 0 && (
            <span className="ml-0.5 rounded-full bg-black/25 px-1.5 text-[11px] font-semibold tabular-nums">
              {favoritesCount}
            </span>
          )}
        </Button>

        <Button
          variant={favoritesActive ? "primary" : "secondary"}
          size="icon-sm"
          onClick={onToggleFavorites}
          aria-label="Favorite"
          aria-pressed={favoritesActive}
          className="shrink-0 sm:hidden"
        >
          <Heart className={cn("size-4", favoritesActive && "fill-current")} />
        </Button>
      </div>
    </header>
  );
}
