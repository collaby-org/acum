"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { normalize } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * The programme search.
 *
 * The client holds a compact index of every slot in the guide — a title, a
 * channel and two timestamps — and filters it as the visitor types. The
 * guide file itself never crosses to the browser.
 */

export type SearchChannel = {
  /** The channel's name. */
  name: string;
  /** The catalogue channel id, when the guide channel is one we know. */
  id: string | null;
};

/** One slot: [title, channel index, start, end]. */
export type SearchSlot = [string, number, number, number];

export type ProgrammeSearchProps = {
  /** The channels the guide knows, by index. */
  channels: SearchChannel[];
  /** Every slot in the guide. */
  slots: SearchSlot[];
  /** The days the guide covers, with their boundaries. */
  days: { date: string; label: string; weekday: string; from: number; to: number }[];
  /** The moment the page was rendered. */
  serverNow: number;
};

export function ProgrammeSearch({
  channels,
  slots,
  days,
  serverNow,
}: ProgrammeSearchProps) {
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // The address bar carries the search, so a result can be shared.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      search ? `?${search}` : window.location.pathname,
    );
  }, [query]);

  const results = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return [];

    const matched = slots
      .filter((slot) => normalize(slot[0]).includes(needle))
      .sort((a, b) => a[2] - b[2]);

    const groups = new Map<
      string,
      { date: string; label: string; weekday: string; rows: typeof matched }
    >();

    for (const slot of matched) {
      const day =
        days.find((entry) => slot[2] >= entry.from && slot[2] <= entry.to) ??
        days[0];
      if (!day) continue;
      const bucket = groups.get(day.date);
      if (bucket) bucket.rows.push(slot);
      else
        groups.set(day.date, {
          date: day.date,
          label: day.label,
          weekday: day.weekday,
          rows: [slot],
        });
    }

    return [...groups.values()];
  }, [slots, days, query]);

  const total = results.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <div>
      <div className="group relative flex h-14 items-center gap-3 rounded-full border border-white/[0.09] bg-white/[0.04] px-5 backdrop-blur-xl transition-[border-color,box-shadow,background-color] duration-500 focus-within:border-signal/50 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_5px_rgba(242,167,27,0.10)]">
        <Search
          aria-hidden
          className="size-5 shrink-0 text-ink-faint transition-colors duration-300 group-focus-within:text-signal"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Numele emisiunii…"
          aria-label="Caută o emisiune în ghid"
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Șterge căutarea"
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors duration-300 hover:bg-white/10 hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-[12px] text-ink-faint">
        {query.trim() ? (
          total > 0 ? (
            <>
              <span className="text-ink-muted">{total}</span> rezultate pentru{" "}
              <span className="text-ink-muted">„{query.trim()}”</span>
            </>
          ) : (
            <>Niciun rezultat pentru „{query.trim()}”.</>
          )
        ) : (
          <>
            Caută în {slots.length} emisiuni, din {channels.length} canale.
            Diacriticele nu contează: „stiinta” găsește și „Ştiinţa”.
          </>
        )}
      </p>

      {results.length > 0 ? (
        <div className="mt-8 space-y-8">
          {results.map((group) => (
            <section key={group.date}>
              <h2 className="flex items-baseline gap-3 border-b border-white/[0.07] pb-3 font-display text-[15px] font-semibold tracking-tight text-ink">
                <span className="capitalize">{group.label}</span>
                <span className="text-[11.5px] font-normal text-ink-faint">
                  {group.rows.length}{" "}
                  {group.rows.length === 1 ? "rezultat" : "rezultate"}
                </span>
              </h2>

              <ol className="divide-y divide-white/[0.05]">
                {group.rows.map((slot, index) => {
                  const [title, channelIndex, start, end] = slot;
                  const channel = channels[channelIndex];
                  const onNow = now >= start && now < end;
                  return (
                    <li key={`${start}-${title}-${index}`}>
                      <Link
                        href={channel?.id ? `/canal/${channel.id}` : "/canale/grupate"}
                        className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 transition-colors duration-300 hover:bg-white/[0.02]"
                      >
                        <span
                          className={cn(
                            "font-mono text-[11.5px] tabular-nums",
                            onNow ? "text-signal/90" : "text-ink-faint",
                          )}
                        >
                          {clock(start)}
                        </span>
                        <span className="min-w-0 flex-1 text-[14px] text-ink transition-colors duration-300 group-hover:text-signal-bright">
                          {title}
                        </span>
                        {onNow ? (
                          <span className="shrink-0 rounded-full bg-live/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-live-soft">
                            Acum
                          </span>
                        ) : null}
                        <span className="shrink-0 text-[11.5px] uppercase tracking-[0.1em] text-ink-faint">
                          {channel?.name ?? "—"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      ) : query.trim() ? (
        <div className="mt-8 rounded-[var(--radius-panel)] border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
          <p className="font-display text-[15px] font-semibold text-ink">
            Ghidul nu conține această emisiune.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-muted">
            Ghidul acoperă o singură zi care se rotește. Poate că emisiunea
            rulează în altă zi sau nu este publicată încă.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** A moment as "19:30", in Romanian time. */
function clock(moment: number): string {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(moment));
}
