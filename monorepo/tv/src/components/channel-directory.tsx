"use client";

/**
 * The directory.
 *
 * One list of every channel in the catalogue, and three filters over it:
 * a letter, a category and a search. The three are **intersected** — a
 * channel is shown only when it passes all of them — and every control
 * counts what it would leave behind, so a letter or a category with nothing
 * under it is disabled instead of quietly emptying the page.
 *
 * The list is a real `<ul>` of rows, each row one link. The page a row goes
 * to owns the player; the directory does not open one.
 */

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, RotateCcw, Search, X } from "lucide-react";
import type { CategoryId, Quality, ServerStatus } from "@/data/types";
import { QualityBadge } from "@/components/channel-card";
import { ChannelLogoImage } from "@/components/pages/channel-logo";
import { Button } from "@/components/ui/button";
import { STATUS_META, familyHue } from "@/lib/channel-meta";
import { alphabetBuckets, bucketKey, matchesQuery } from "@/lib/navigation";
import { cn, formatViewers, plural } from "@/lib/utils";

/** What a row needs — the catalogue channel, projected down and pre-read. */
export type DirectoryChannel = {
  id: string;
  name: string;
  family: string;
  familyKey: string;
  category: CategoryId;
  logo: string | null;
  logoHd: string | null;
  logoDark: boolean;
  status: ServerStatus;
  quality: Quality;
  /** What the guide says is on right now, read on the server. */
  now: string | null;
  /** When that slot ends, already formatted as a clock ("21:00"). */
  until: string | null;
  /** Browsers watching here right now, counted at our own proxy. */
  viewers: number;
};

export type DirectoryCategory = {
  id: CategoryId;
  label: string;
};

export type ChannelDirectoryProps = {
  /** The whole catalogue, already in alphabetical order. */
  channels: DirectoryChannel[];
  /** The taxonomy, in the order the site presents it. */
  categories: DirectoryCategory[];
};

const COUNT_ID = "director-numar";
const LIST_ID = "director-lista";

/* ------------------------------------------------------------------ *
 * Counting
 * ------------------------------------------------------------------ */

function countBy<T>(items: readonly T[], key: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/** "12 canale", "1 canal", "20 de canale" — or "niciun canal". */
function channelCount(count: number) {
  if (count === 0) return "niciun canal";
  return `${count} ${plural(count, "canal", "canale", "de canale")}`;
}

/**
 * The intersection, in words: „care încep cu «A», sunt în categoria Sport și
 * conțin «pro»”. The number in front of it is the count of that sentence, so
 * the two can never disagree.
 */
function intersectPhrase(parts: string[]) {
  if (parts.length === 0) return null;
  if (parts.length === 1) return `care ${parts[0]}`;
  return `care ${parts.slice(0, -1).join(", ")} și ${parts[parts.length - 1]}`;
}

/* ------------------------------------------------------------------ *
 * The screen
 * ------------------------------------------------------------------ */

export function ChannelDirectory({
  channels,
  categories,
}: ChannelDirectoryProps) {
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const countRef = useRef<HTMLParagraphElement>(null);

  const needle = query.trim();
  const filtered = needle.length > 0 || letter !== null || category !== null;

  /** Every letter the catalogue can produce, in index order. */
  const letters = useMemo(
    () =>
      alphabetBuckets(channels).map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
      })),
    [channels],
  );

  /**
   * The three pools. Each facet counts against the **other** two, so a chip
   * tells the truth about what choosing it would do:
   *
   *   afterSearch  search only                → the letter and category inputs
   *   byLetterFacet search + category         → the letters' counts
   *   byCategoryFacet search + letter         → the categories' counts
   *   results       search + letter + category→ the list
   */
  const afterSearch = useMemo(
    () => channels.filter((channel) => matchesQuery(channel, needle)),
    [channels, needle],
  );

  const byLetterFacet = useMemo(
    () =>
      afterSearch.filter(
        (channel) => category === null || channel.category === category,
      ),
    [afterSearch, category],
  );

  const byCategoryFacet = useMemo(
    () =>
      afterSearch.filter(
        (channel) =>
          letter === null || bucketKey(channel.name) === letter,
      ),
    [afterSearch, letter],
  );

  const results = useMemo(
    () =>
      byLetterFacet.filter(
        (channel) => letter === null || bucketKey(channel.name) === letter,
      ),
    [byLetterFacet, letter],
  );

  const letterCounts = useMemo(
    () => countBy(byLetterFacet, (channel) => bucketKey(channel.name)),
    [byLetterFacet],
  );

  const categoryCounts = useMemo(
    () => countBy(byCategoryFacet, (channel) => channel.category),
    [byCategoryFacet],
  );

  const categoryLabels = useMemo(
    () => new Map(categories.map((entry) => [entry.id, entry.label])),
    [categories],
  );

  const clearFilters = () => {
    setQuery("");
    setLetter(null);
    setCategory(null);
    // The button that was pressed is gone the moment the filters clear, so
    // focus lands on the line that says how many channels are back.
    countRef.current?.focus();
  };

  const total = channels.length;
  const shown = results.length;

  const letterLabel =
    letters.find((entry) => entry.key === letter)?.label ?? letter;
  const categoryLabel =
    categories.find((entry) => entry.id === category)?.label ?? category;

  const clauses: string[] = [];
  if (letterLabel) clauses.push(`încep cu „${letterLabel}”`);
  if (categoryLabel) clauses.push(`sunt în categoria ${categoryLabel}`);
  if (needle) clauses.push(`conțin „${needle}”`);

  const unit = plural(total, "canal", "canale", "de canale");
  const phrase = intersectPhrase(clauses);

  return (
    <div className="relative">
      {/* ------------------------------------------------------------ *
       * The toolbar. It sticks under the page bar from `sm` up — the
       * filters stay beside the list on the screens that have the
       * room for it, and scroll away as one block on a phone, where
       * three rows of controls would eat the viewport.
       * ------------------------------------------------------------ */}
      <div className="z-30 border-b border-white/[0.06] fx-glass-bar sm:sticky sm:top-[72px]">
        <div className="mx-auto max-w-[1800px] px-4 py-2.5 sm:px-8 sm:py-3 lg:px-12">
          {/* Search */}
          <div className="flex h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ease-spring focus-within:border-signal/45 focus-within:bg-canvas/70 focus-within:shadow-[0_0_0_4px_rgba(242,167,27,0.10)] sm:max-w-md">
            <Search aria-hidden className="ml-3.5 size-4 shrink-0 text-ink-faint" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && query.length > 0) {
                  event.preventDefault();
                  setQuery("");
                }
              }}
              placeholder="Caută un canal…"
              aria-label="Caută în director după nume, familie sau categorie"
              aria-controls={`${LIST_ID} ${COUNT_ID}`}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Șterge căutarea"
                className="mr-2 grid size-6 shrink-0 place-items-center rounded-full text-ink-faint transition duration-300 ease-spring hover:bg-white/10 hover:text-ink"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* The alphabet */}
          <div className="mt-2.5 flex items-center gap-3">
            <span
              aria-hidden
              className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-faint lg:block"
            >
              Litera
            </span>
            <div
              role="group"
              aria-label="Filtru alfabetic"
              className="fx-hide-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain py-0.5"
            >
              <Chip
                active={letter === null}
                onClick={() => setLetter(null)}
                ariaLabel="Toate canalele"
                className="px-4"
              >
                Toate
              </Chip>
              {letters.map((entry) => {
                const count = letterCounts.get(entry.key) ?? 0;
                const active = letter === entry.key;
                return (
                  <Chip
                    key={entry.key}
                    active={active}
                    // A letter with nothing under the other two filters is
                    // disabled; the one already chosen stays usable so it can
                    // be unpicked.
                    disabled={count === 0 && !active}
                    onClick={() => setLetter(active ? null : entry.key)}
                    ariaLabel={`${entry.label} — ${channelCount(count)}`}
                    title={`${entry.label} — ${channelCount(count)}`}
                  >
                    {entry.label}
                  </Chip>
                );
              })}
            </div>
          </div>

          {/* The categories */}
          <div className="mt-2 flex items-center gap-3">
            <span
              aria-hidden
              className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-faint lg:block"
            >
              Categoria
            </span>
            <div
              role="group"
              aria-label="Filtru pe categorii"
              className="fx-hide-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain py-0.5"
            >
              <Chip
                active={category === null}
                onClick={() => setCategory(null)}
                className="px-4"
              >
                Toate categoriile
              </Chip>
              {categories.map((entry) => {
                const count = categoryCounts.get(entry.id) ?? 0;
                const active = category === entry.id;
                return (
                  <Chip
                    key={entry.id}
                    active={active}
                    disabled={count === 0 && !active}
                    onClick={() => setCategory(active ? null : entry.id)}
                    ariaLabel={`${entry.label} — ${channelCount(count)}`}
                    title={`${entry.label} — ${channelCount(count)}`}
                    className="font-sans"
                  >
                    {entry.label}
                  </Chip>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------- *
       * How many are left, and which three filters left them.
       * -------------------------------------------------------------- */}
      <div className="mx-auto max-w-[1800px] px-4 pb-16 pt-5 sm:px-8 sm:pt-6 lg:px-12">
        <p
          ref={countRef}
          id={COUNT_ID}
          tabIndex={-1}
          aria-live="polite"
          className="text-[13.5px] leading-relaxed text-ink-muted outline-none"
        >
          <span className="font-display text-[15px] font-semibold tabular-nums text-ink">
            {filtered ? shown : total}
          </span>
          {filtered ? ` din ${total} ${unit}` : ` ${unit}, în ordine alfabetică`}
          {filtered && phrase ? ` ${phrase}` : ""}
        </p>

        {shown === 0 ? (
          <div
            id={LIST_ID}
            className="mt-5 rounded-[var(--radius-panel)] border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center"
          >
            <p className="text-[15px] leading-relaxed text-ink-muted">
              Niciun canal nu se potrivește cu filtrele alese.
            </p>
            <Button
              variant="secondary"
              size="md"
              onClick={clearFilters}
              className="mt-5"
            >
              <RotateCcw aria-hidden className="size-4" />
              Golește filtrele
            </Button>
          </div>
        ) : (
          <ul
            id={LIST_ID}
            aria-labelledby={COUNT_ID}
            className="mt-4 border-t border-white/[0.06]"
          >
            {results.map((channel) => (
              <DirectoryRow
                key={channel.id}
                channel={channel}
                categoryLabel={
                  categoryLabels.get(channel.category) ?? channel.category
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * A chip
 * ------------------------------------------------------------------ */

type ChipProps = {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  ariaLabel?: string;
  title?: string;
  className?: string;
};

/**
 * One filter chip.
 *
 * The chosen one is tinted **and** carries a short bar of gold under the
 * label: a mark, not only a colour, so the selection survives a screen that
 * cannot see the difference between two shades of dark.
 */
function Chip({
  active,
  disabled = false,
  onClick,
  children,
  ariaLabel,
  title,
  className,
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "relative grid h-9 min-w-9 shrink-0 place-items-center rounded-lg border px-2.5 font-display text-[13px] font-semibold tracking-tight sm:h-10 sm:min-w-10",
        "transition-[background-color,border-color,color] duration-200 ease-spring motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
        disabled
          ? "cursor-not-allowed border-white/[0.04] bg-white/[0.015] text-ink-faint/45"
          : active
            ? "border-signal/60 bg-signal/15 text-ink"
            : "border-white/[0.07] bg-white/[0.03] text-ink-muted hover:border-signal/35 hover:bg-white/[0.07] hover:text-ink",
        className,
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-1 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-signal transition-[width] duration-300 ease-spring motion-reduce:transition-none",
          active ? "w-4" : "w-0",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * A row
 * ------------------------------------------------------------------ */

/**
 * One channel, as a line of the directory: the logo, the name with its
 * quality, what is on right now, the category, and how it is doing.
 *
 * The row is one link and one tab stop. The live mark is never colour
 * alone — it carries the word, or the number of people watching.
 */
function DirectoryRow({
  channel,
  categoryLabel,
}: {
  channel: DirectoryChannel;
  categoryLabel: string;
}) {
  const hue = familyHue(channel.familyKey, channel.category);
  const live = channel.status === "live";
  const status = STATUS_META[channel.status];

  return (
    <li className="border-b border-white/[0.05] last:border-b-0">
      <Link
        href={`/canal/${channel.id}`}
        className={cn(
          "group grid items-center gap-x-3 gap-y-1 rounded-[calc(var(--radius-card)-2px)] px-3 py-3",
          "grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_7rem_auto] sm:gap-x-4 sm:px-4",
          "transition-colors duration-200 hover:bg-white/[0.045] motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
        )}
      >
        {/* The logo, on a plate when the artwork is dark. */}
        <span
          className={cn(
            "grid h-8 w-14 shrink-0 place-items-center overflow-hidden rounded-[6px] border transition-colors duration-200",
            channel.logoDark
              ? "border-white/20 bg-white/92"
              : "border-white/10 bg-white/[0.06] group-hover:border-white/20",
          )}
        >
          <ChannelLogoImage
            src={
              ["hd", "fhd", "uhd"].includes(channel.quality)
                ? (channel.logoHd ?? channel.logo)
                : channel.logo
            }
            name={channel.name}
            className="h-full w-full object-contain p-0.5"
            sizes="56px"
          />
        </span>

        {/* The name, and what is on. */}
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-display text-[14.5px] font-semibold leading-tight tracking-tight text-ink">
              {channel.name}
            </span>
            <QualityBadge
              quality={channel.quality}
              showStandard
              className="shrink-0"
            />
          </span>
          <span className="mt-1 flex min-w-0 items-baseline gap-1.5">
            {channel.now ? (
              <>
                <span
                  className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: `hsl(${hue} 85% 72%)` }}
                >
                  Acum
                </span>
                <span className="min-w-0 truncate text-[12px] leading-tight text-ink-muted">
                  {channel.now}
                </span>
                {channel.until ? (
                  <span className="hidden shrink-0 font-mono text-[10.5px] tabular-nums text-ink-faint md:inline">
                    până la {channel.until}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="truncate text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                Fără program în ghid
              </span>
            )}
          </span>
        </span>

        {/* The category — the axis the toolbar filters on. */}
        <span className="hidden truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-faint sm:block">
          {categoryLabel}
        </span>

        {/* How it is doing: our own audience when there is one, the word
            when there is not, the status when it cannot play. */}
        <span className="flex shrink-0 items-center justify-end gap-1.5">
          {channel.viewers > 0 ? (
            <>
              <span aria-hidden className="size-1.5 rounded-full bg-live" />
              <span className="text-[11.5px] font-semibold tabular-nums text-ink">
                {formatViewers(channel.viewers)}
              </span>
              <span className="sr-only">spectatori acum</span>
            </>
          ) : live ? (
            <>
              <span aria-hidden className="size-1.5 rounded-full bg-live" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-live-soft">
                Live
              </span>
            </>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {status.label}
            </span>
          )}
          <ChevronRight
            aria-hidden
            className="hidden size-4 text-ink-faint transition-[transform,color] duration-300 ease-spring group-hover:translate-x-0.5 group-hover:text-signal-bright motion-reduce:transition-none sm:block"
          />
        </span>
      </Link>
    </li>
  );
}
