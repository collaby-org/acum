/**
 * The catalogue.
 *
 * The same view of the catalogue the visitor gets: names, artwork, status,
 * quality. No upstream address, no source page, and no feed stack — a
 * channel's number of feeds is not something the browser is told, here or
 * anywhere else.
 *
 * The totals are there: how many channels, how many feeds, how many are
 * live, how many have a spare one to fall back on.
 */
"use client";

import { useMemo, useState } from "react";
import { Loader2, Search, Tv } from "lucide-react";
import { DeskDenied } from "@/components/admin/denied";
import {
  Panel,
  Pill,
  SectionTitle,
  Stat,
  TableShell,
  Td,
  Th,
  formatNumber,
} from "@/components/admin/parts";
import { useDeskResource } from "@/components/admin/session";
import type { CataloguePayload, CategoryId } from "@/components/admin/types";
import { QUALITY_META, STATUS_META } from "@/lib/channel-meta";
import { CATEGORY_LABELS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function CataloguePanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | null>(null);

  const { data, status, message, reload } = useDeskResource<CataloguePayload>(
    "/api/admin/catalogue",
    20_000,
  );

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.channels.filter((channel) => {
      if (category && channel.category !== category) return false;
      if (!needle) return true;
      return (
        channel.name.toLowerCase().includes(needle) ||
        channel.family.toLowerCase().includes(needle)
      );
    });
  }, [data, query, category]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="inline-flex items-center gap-3 text-[13px] text-ink-faint">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Se citește catalogul…
        </span>
      </div>
    );
  }

  if (status !== "ok" || !data) {
    return (
      <DeskDenied
        denial={{
          status:
            status === "signed-out"
              ? "signed-out"
              : status === "forbidden"
                ? "forbidden"
                : status === "no-key"
                  ? "no-key"
                  : "error",
          message,
        }}
        onSignedIn={reload}
      />
    );
  }

  const summary = data.summary;
  const categories = Object.keys(CATEGORY_LABELS) as CategoryId[];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Canale" value={formatNumber(summary.channels)} hint="în catalog" />
        <Stat label="Surse" value={formatNumber(summary.feeds)} hint="surse în total" />
        <Stat label="Live" value={formatNumber(summary.live)} hint="se pot reda acum" accent />
        <Stat
          label="Cu rezervă"
          value={formatNumber(summary.withFallback)}
          hint="au o sursă de rezervă"
        />
      </div>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionTitle hint="Ce rulează pe site, canal cu canal.">
            Catalog
          </SectionTitle>
          <label className="group relative flex h-11 w-full items-center gap-2.5 rounded-full border border-white/[0.09] bg-white/[0.035] px-4 transition-colors duration-300 focus-within:border-signal/45 lg:max-w-sm">
            <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
            <span className="sr-only">Caută un canal</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Caută un canal…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory(null)}
            aria-pressed={category === null}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-300",
              category === null
                ? "border-signal/45 bg-signal/12 text-signal-bright"
                : "border-white/[0.08] bg-white/[0.03] text-ink-faint hover:border-white/20 hover:text-ink-muted",
            )}
          >
            Toate
          </button>
          {categories.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              aria-pressed={category === id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-300",
                category === id
                  ? "border-signal/45 bg-signal/12 text-signal-bright"
                  : "border-white/[0.08] bg-white/[0.03] text-ink-faint hover:border-white/20 hover:text-ink-muted",
              )}
            >
              {CATEGORY_LABELS[id]}
            </button>
          ))}
        </div>
      </Panel>

      <TableShell>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <Th>Canal</Th>
              <Th>Categorie</Th>
              <Th>Stare</Th>
              <Th>Calitate</Th>
              <Th align="right">Acum</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {rows.length === 0 ? (
              <tr>
                <Td className="py-8 text-center text-ink-faint" align="center">
                  <span className="inline-flex items-center gap-2">
                    <Search className="size-4" aria-hidden />
                    Niciun canal nu se potrivește.
                  </span>
                </Td>
              </tr>
            ) : (
              rows.map((channel) => {
                const viewers = data.live[channel.id] ?? 0;
                return (
                  <tr
                    key={channel.id}
                    className="transition-colors duration-300 hover:bg-white/[0.022]"
                  >
                    <Td>
                      <span className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.04]">
                          {channel.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={channel.logo}
                              alt=""
                              className="size-full object-contain p-1"
                              loading="lazy"
                            />
                          ) : (
                            <Tv className="size-3.5 text-ink-faint" aria-hidden />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] text-ink">
                            {channel.name}
                          </span>
                          <span className="block truncate text-[12px] text-ink-faint">
                            {channel.family}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-faint">
                      {CATEGORY_LABELS[channel.category] ?? channel.category}
                    </Td>
                    <Td>
                      <Pill tone={channel.status === "live" ? "live" : "quiet"}>
                        {STATUS_META[channel.status]?.label ?? channel.status}
                      </Pill>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-faint">
                      {QUALITY_META[channel.quality]?.label || "—"}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {viewers > 0 ? (
                        <span className="text-signal-bright">
                          {formatNumber(viewers)}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}
