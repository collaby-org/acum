"use client";

import Image from "next/image";
import { Heart, Play, Radio, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { STATUS_META } from "@/lib/channel-meta";
import { groupByCategory, rankResults, type ChannelLike } from "@/lib/navigation";
import { cn, plural } from "@/lib/utils";

type SearchPanelProps<T extends ChannelLike> = {
  query: string;
  onQueryChange: (value: string) => void;
  channels: T[];
  onPlay: (channel: T) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (
    channel: T,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  onClose?: () => void;
  className?: string;
};

const SUGGESTIONS = ["Antena", "Pro TV", "HBO", "Kanal D", "sport"];

function reducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Instant search over the catalogue.
 *
 * Diacritics and case are ignored, results are ranked (exact name, then name,
 * then family) and grouped by category. The keyboard drives everything:
 * ↑/↓ walk the results, Enter plays, Escape clears, `/` or ⌘K focuses the
 * field.
 */
export function SearchPanel<T extends ChannelLike>({
  query,
  onQueryChange,
  channels,
  onPlay,
  isFavorite,
  onToggleFavorite,
  onClose,
  className,
}: SearchPanelProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastQuery, setLastQuery] = useState(query);

  // A new query means a new result set: start at the top again.
  if (lastQuery !== query) {
    setLastQuery(query);
    setActiveIndex(0);
  }

  const trimmed = query.trim();

  const results = useMemo(
    () => (trimmed ? rankResults(channels, trimmed) : []),
    [channels, trimmed],
  );

  const groups = useMemo(() => groupByCategory(results), [results]);

  const flat = useMemo(
    () => groups.flatMap((group) => group.channels),
    [groups],
  );

  const index = Math.min(activeIndex, Math.max(flat.length - 1, 0));
  const active = flat[index];

  const positionOf = useMemo(() => {
    const map = new Map<string, number>();
    flat.forEach((channel, position) => map.set(channel.id, position));
    return map;
  }, [flat]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }, [index]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const move = (delta: number) => {
    if (flat.length === 0) return;
    setActiveIndex((current) => {
      const next = current + delta;
      if (next < 0) return flat.length - 1;
      if (next >= flat.length) return 0;
      return next;
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Enter":
        if (active) {
          event.preventDefault();
          onPlay(active);
        }
        break;
      case "Escape":
        event.preventDefault();
        if (query) onQueryChange("");
        else onClose?.();
        break;
      default:
        break;
    }
  };

  return (
    <section
      role="search"
      aria-label="Caută un canal"
      className={cn(
        "overflow-hidden rounded-[var(--radius-panel)] bg-canvas-raised/85 backdrop-blur-xl fx-edge",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <Search aria-hidden className="size-4 shrink-0 text-ink-faint" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Caută un canal, o familie, o categorie…"
          aria-label="Caută un canal"
          aria-describedby="search-panel-count"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Șterge căutarea"
            className="grid size-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide căutarea"
            className="grid size-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>

      <p
        id="search-panel-count"
        aria-live="polite"
        className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
      >
        {trimmed
          ? `${results.length} ${plural(results.length, "rezultat", "rezultate", "de rezultate")}`
          : "Caută în toate canalele"}
      </p>

      {flat.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="font-display text-lg font-semibold">
            {trimmed ? "Niciun canal găsit" : "Începe să scrii"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            {trimmed
              ? `Nu am găsit nimic pentru „${trimmed}”. Încearcă alt nume — de exemplu „Antena”, „HBO” sau „sport”.`
              : "Scrie cel puțin două litere. Căutarea ignoră diacriticele și majusculele."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onQueryChange(suggestion)}
                className="rounded-full border border-hairline-strong px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-signal/60 hover:text-signal-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-[min(70vh,640px)] overflow-y-auto px-2 pb-3">
          {groups.map((group) => (
            <section key={group.id} className="mt-2">
              <h3 className="sticky top-0 z-10 flex items-center justify-between bg-canvas-raised/95 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted backdrop-blur">
                {group.label}
                <span className="text-ink-faint tabular-nums">
                  {group.channels.length}
                </span>
              </h3>
              <ul role="list">
                {group.channels.map((channel) => {
                  const position = positionOf.get(channel.id) ?? 0;
                  const status = STATUS_META[channel.status];
                  const isLive = channel.status === "live";
                  const favorite = isFavorite(channel.id);

                  return (
                    <li key={channel.id}>
                      <div
                        className={cn(
                          "group/row flex items-center gap-1 rounded-xl px-1 transition-colors duration-150",
                          position === index
                            ? "bg-white/8 ring-1 ring-signal/40"
                            : "hover:bg-white/4",
                        )}
                      >
                        <button
                          ref={position === index ? activeRef : undefined}
                          type="button"
                          onClick={() => onPlay(channel)}
                          onMouseEnter={() => setActiveIndex(position)}
                          aria-current={position === index}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                        >
                          <span className="grid h-9 w-12 shrink-0 place-items-center rounded-md bg-black/40">
                            {channel.logo ? (
                              <Image
                                src={channel.logo}
                                alt=""
                                width={40}
                                height={20}
                                className="h-5 w-10 object-contain"
                                unoptimized
                              />
                            ) : (
                              <span className="font-display text-[10px] font-bold text-ink-faint">
                                {channel.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium text-ink">
                              {channel.name}
                            </span>
                            <span className="block truncate text-[12px] text-ink-muted">
                              {channel.family}
                            </span>
                          </span>

                          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                            {isLive ? (
                              <span
                                aria-hidden
                                className="size-1.5 rounded-full bg-live"
                              />
                            ) : (
                              <Radio aria-hidden className="size-2.5" />
                            )}
                            {isLive ? "Live" : status.label}
                          </span>

                          <Play
                            aria-hidden
                            className="size-4 shrink-0 text-ink-faint transition-colors group-hover/row:text-ink"
                          />
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleFavorite(channel, event);
                          }}
                          aria-label={
                            favorite
                              ? `Elimină ${channel.name} din favorite`
                              : `Adaugă ${channel.name} la favorite`
                          }
                          aria-pressed={favorite}
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-full border border-transparent text-ink-faint transition-[color,background-color,border-color] duration-150 hover:border-hairline-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                            favorite && "text-signal",
                          )}
                        >
                          <Heart
                            aria-hidden
                            className={cn("size-4", favorite && "fill-current")}
                          />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="hidden border-t border-hairline px-4 py-2.5 text-[11px] text-ink-faint sm:block">
        <kbd className="rounded border border-hairline-strong px-1">↑</kbd>{" "}
        <kbd className="rounded border border-hairline-strong px-1">↓</kbd>{" "}
        navighezi ·{" "}
        <kbd className="rounded border border-hairline-strong px-1">Enter</kbd>{" "}
        pornește ·{" "}
        <kbd className="rounded border border-hairline-strong px-1">Esc</kbd>{" "}
        șterge
      </p>
    </section>
  );
}
