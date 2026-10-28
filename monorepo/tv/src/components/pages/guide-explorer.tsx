"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock, Search, X } from "lucide-react";
import type { Slot } from "@/lib/guide-pages";
import { cn } from "@/lib/utils";

/**
 * The interactive guide.
 *
 * The client receives a compact index — a title, a start and an end for every
 * slot — never the guide file itself. Everything the page shows is computed
 * here from that index.
 */

export type GuideDayRange = {
  /** "2026-10-22". */
  date: string;
  /** The Romanian label: "joi, 22 octombrie 2026". */
  label: string;
  /** The short weekday: "Joi". */
  weekday: string;
  /** The first slot of the day, in epoch milliseconds. */
  from: number;
  /** The last slot of the day, in epoch milliseconds. */
  to: number;
};

export type GuideExplorerProps = {
  /** The guide's channels. */
  channels: { slug: string; name: string; count: number }[];
  /** The slots, by channel slug. */
  slots: Record<string, Slot[]>;
  /** The days the guide covers. */
  days: GuideDayRange[];
  /** The catalogue channel id for each guide slug, so a slot can be linked. */
  catalogue: Record<string, string>;
  /** The channel to open first. */
  initialChannel?: string | null;
  /** The day to open first. */
  initialDay?: string | null;
  /** The moment the page was rendered, so the clock starts where the server left it. */
  serverNow: number;
};

export function GuideExplorer({
  channels,
  slots,
  days,
  catalogue,
  initialChannel,
  initialDay,
  serverNow,
}: GuideExplorerProps) {
  const [query, setQuery] = useState("");
  const [slug, setSlug] = useState<string | null>(
    initialChannel ?? channels[0]?.slug ?? null,
  );
  const [day, setDay] = useState<string | null>(
    initialDay ?? days[0]?.date ?? null,
  );
  const [now, setNow] = useState(serverNow);

  // The clock moves while the page is open; a guide that freezes is a lie.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Keep the address bar in step with the selection, so the view can be
  // shared. The history API is used directly: no router round trip, and no
  // re-render of the page that the user is looking at.
  useEffect(() => {
    const params = new URLSearchParams();
    if (slug) params.set("canal", slug);
    if (day) params.set("zi", day);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
  }, [slug, day]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return channels;
    return channels.filter((channel) =>
      channel.name.toLowerCase().includes(needle),
    );
  }, [channels, query]);

  const current = channels.find((channel) => channel.slug === slug) ?? null;
  const currentDay = days.find((entry) => entry.date === day) ?? days[0] ?? null;

  const rows = useMemo(() => {
    if (!current || !currentDay) return [];
    const list = slots[current.slug] ?? [];
    return list
      .filter(
        (slot) => slot[1] >= currentDay.from && slot[1] <= currentDay.to,
      )
      .sort((a, b) => a[1] - b[1]);
  }, [slots, current, currentDay]);

  const channelId = current ? catalogue[current.slug] : undefined;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-7">
      {/* The channels */}
      <div className="min-w-0">
        <div className="flex h-10 items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] px-3.5 backdrop-blur-xl focus-within:border-signal/45 focus-within:shadow-[0_0_0_4px_rgba(242,167,27,0.10)]">
          <Search aria-hidden className="size-4 shrink-0 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrează canalele…"
            aria-label="Filtrează canalele ghidului"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Șterge filtrul"
              className="grid size-6 shrink-0 place-items-center rounded-full text-ink-faint transition-colors duration-300 hover:bg-white/10 hover:text-ink"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </div>

        <ul className="mask-edges mt-3 flex gap-2 overflow-x-auto pb-1 fx-hide-scrollbar lg:max-h-[560px] lg:flex-col lg:overflow-y-auto lg:pb-0">
          {visible.map((channel) => {
            const active = channel.slug === slug;
            return (
              <li key={channel.slug} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => setSlug(channel.slug)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-full border px-3.5 py-2 text-left text-[13px] transition-[background-color,border-color,color,transform] duration-300 ease-spring",
                    active
                      ? "border-signal/40 bg-signal/[0.10] text-ink"
                      : "border-transparent text-ink-muted hover:border-white/10 hover:bg-white/[0.04] hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      active ? "bg-signal" : "bg-white/18",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                  <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink-faint">
                    {channel.count}
                  </span>
                </button>
              </li>
            );
          })}
          {visible.length === 0 ? (
            <li className="px-1 py-4 text-[12.5px] text-ink-faint">
              Niciun canal nu se potrivește filtrei.
            </li>
          ) : null}
        </ul>
      </div>

      {/* The day */}
      <div className="min-w-0">
        {days.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {days.map((entry) => {
              const active = entry.date === currentDay?.date;
              return (
                <button
                  key={entry.date}
                  type="button"
                  onClick={() => setDay(entry.date)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12.5px] transition-[background-color,border-color,color] duration-300",
                    active
                      ? "border-signal/40 bg-signal/[0.10] text-ink"
                      : "border-white/[0.08] bg-white/[0.03] text-ink-muted hover:border-white/16 hover:text-ink",
                  )}
                >
                  {entry.weekday}
                  <span className="ml-2 font-mono text-[10.5px] tabular-nums text-ink-faint">
                    {entry.date.slice(8)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-5 rounded-[var(--radius-panel)] border border-white/[0.07] bg-white/[0.025]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="min-w-0">
              <h3 className="truncate font-display text-[17px] font-semibold tracking-tight text-ink">
                {current?.name ?? "Alege un canal"}
              </h3>
              {currentDay ? (
                <p className="mt-0.5 text-[11.5px] capitalize text-ink-faint">
                  {currentDay.label}
                </p>
              ) : null}
            </div>
            {channelId ? (
              <Link
                href={`/canal/${channelId}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-[12.5px] text-ink transition-[transform,border-color,background-color] duration-300 ease-spring hover:-translate-y-px hover:border-signal/40 hover:bg-white/[0.09]"
              >
                Deschide canalul
              </Link>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-ink-faint">
              Ghidul nu are nimic pentru acest canal în ziua aleasă.
            </p>
          ) : (
            <ol className="divide-y divide-white/[0.05]">
              {rows.map((slot, index) => {
                const [title, start, end] = slot;
                const onNow = now >= start && now < end;
                const past = now >= end;
                const span = Math.max(1, end - start);
                const progress = onNow ? (now - start) / span : 0;

                return (
                  <li
                    key={`${start}-${title}-${index}`}
                    className={cn(
                      "relative px-5 py-3.5 transition-colors duration-300",
                      onNow ? "bg-signal/[0.045]" : undefined,
                    )}
                  >
                    {onNow ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-signal to-signal/30"
                      />
                    ) : null}
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span
                        className={cn(
                          "font-mono text-[11.5px] tabular-nums",
                          onNow ? "text-signal/90" : "text-ink-faint",
                        )}
                      >
                        {clock(start)}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 text-[13.5px] leading-snug",
                          past ? "text-ink-faint" : "text-ink",
                        )}
                      >
                        {title}
                      </span>
                      {onNow ? (
                        <span className="shrink-0 rounded-full bg-live/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-live-soft">
                          Acum
                        </span>
                      ) : (
                        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink-faint">
                          {clock(end)}
                        </span>
                      )}
                    </div>

                    {onNow ? (
                      <span className="mt-2 block h-[3px] w-full max-w-[260px] overflow-hidden rounded-full bg-white/[0.09]">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-signal to-signal-bright"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <p className="mt-4 flex items-center gap-2 text-[11.5px] text-ink-faint">
          <Clock aria-hidden className="size-3.5" />
          Orele sunt ora României. Ghidul se reîncarcă la fiecare cerere, deci
          ce vezi aici este ultima versiune publicată.
        </p>
      </div>
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
