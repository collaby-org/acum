/**
 * The accounts.
 *
 * Everyone who has an account, who they are and what they may watch. The
 * search and the filter are done by the database, so the list stays quick
 * however many accounts there are.
 *
 * The grant is the last column: a button that opens the panel where the
 * plan, the bypass and the reason are set.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Search, ShieldCheck, UserPlus } from "lucide-react";
import { DeskDenied } from "@/components/admin/denied";
import { GrantSheet } from "@/components/admin/grant-sheet";
import {
  Panel,
  Pill,
  SectionTitle,
  TableShell,
  Td,
  Th,
  formatDate,
  formatNumber,
  timeAgo,
} from "@/components/admin/parts";
import { useDeskResource } from "@/components/admin/session";
import type { Account, AccountsPayload, Plan } from "@/components/admin/types";
import { planDefinition } from "@/lib/supabase/plans";
import { cn } from "@/lib/utils";

/** The plans, in the order they are offered. */
const FILTERS: { plan: Plan | null; label: string }[] = [
  { plan: null, label: "Toate" },
  { plan: "free", label: "Gratuit" },
  { plan: "monthly", label: "Individual" },
  { plan: "household", label: "Gospodărie" },
  { plan: "lifetime", label: "Viață" },
  { plan: "comp", label: "Concediat" },
];

function planLabel(plan: Plan): string {
  if (plan === "comp") return "Concediat";
  return planDefinition(plan).name;
}

export function AccountsPanel() {
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<Account | null>(null);

  // The search waits for a pause in the typing.
  useEffect(() => {
    const timer = window.setTimeout(() => setTyped(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const path = useMemo(() => {
    const search = new URLSearchParams();
    if (typed.trim()) search.set("q", typed.trim());
    if (plan) search.set("plan", plan);
    const queryString = search.toString();
    return queryString ? `/api/admin/accounts?${queryString}` : "/api/admin/accounts";
  }, [typed, plan]);

  const { data, status, message, reload } = useDeskResource<AccountsPayload>(path);

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="inline-flex items-center gap-3 text-[13px] text-ink-faint">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Se citesc conturile…
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

  const accounts = data.accounts;

  return (
    <div className="space-y-5">
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle hint="Cine are cont, ce plan are și cât a văzut azi.">
            Conturi
          </SectionTitle>
          <p className="text-[13px] text-ink-faint">
            {accounts.length} {accounts.length === 1 ? "cont afișat" : "conturi afișate"}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="group relative flex h-11 flex-1 items-center gap-2.5 rounded-full border border-white/[0.09] bg-white/[0.035] px-4 transition-colors duration-300 focus-within:border-signal/45 focus-within:bg-white/[0.06]">
            <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
            <span className="sr-only">Caută un cont</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Caută după e-mail sau nume…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((filter) => {
              const active = plan === filter.plan;
              return (
                <button
                  key={filter.label}
                  type="button"
                  onClick={() => setPlan(filter.plan)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors duration-300",
                    active
                      ? "border-signal/45 bg-signal/12 text-signal-bright"
                      : "border-white/[0.08] bg-white/[0.03] text-ink-faint hover:border-white/20 hover:text-ink-muted",
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <TableShell>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <Th>Cont</Th>
              <Th>Plan</Th>
              <Th>Creat</Th>
              <Th>Ultima veză</Th>
              <Th align="right">Azi</Th>
              <Th align="right">Acțiuni</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {accounts.length === 0 ? (
              <tr>
                <Td className="py-8 text-center text-ink-faint" align="center">
                  <span className="inline-flex items-center gap-2">
                    <Search className="size-4" aria-hidden />
                    Niciun cont nu se potrivește.
                  </span>
                </Td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr
                  key={account.id}
                  className="transition-colors duration-300 hover:bg-white/[0.022]"
                >
                  <Td>
                    <span className="block text-[13.5px] text-ink">
                      {account.display_name || account.email || "Fără e-mail"}
                    </span>
                    {account.display_name && account.email ? (
                      <span className="block text-[12px] text-ink-faint">
                        {account.email}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Pill
                        tone={
                          account.plan === "free"
                            ? "quiet"
                            : account.plan === "comp"
                              ? "signal"
                              : "neutral"
                        }
                      >
                        {planLabel(account.plan)}
                      </Pill>
                      {account.bypass ? (
                        <Pill tone="signal">
                          <KeyRound className="size-3" aria-hidden />
                          bypass
                        </Pill>
                      ) : null}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-faint">
                    {formatDate(account.created_at)}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-faint">
                    {timeAgo(account.last_seen_at)}
                  </Td>
                  <Td align="right" className="tabular-nums text-ink-muted">
                    {account.minutes_today > 0
                      ? `${formatNumber(account.minutes_today)} min`
                      : "—"}
                  </Td>
                  <Td align="right">
                    <button
                      type="button"
                      onClick={() => setSelected(account)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors duration-300 hover:border-signal/45 hover:bg-signal/10 hover:text-signal-bright"
                    >
                      <UserPlus className="size-3.5" aria-hidden />
                      Acordă
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableShell>

      {selected?.note ? (
        <p className="flex items-start gap-2 px-1 text-[12px] leading-relaxed text-ink-faint">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-signal/70" aria-hidden />
          Ultima acordare: {selected.note.split("\n").filter(Boolean).slice(-1)[0]}
        </p>
      ) : null}

      <GrantSheet
        key={selected?.id ?? "none"}
        account={selected}
        onClose={() => setSelected(null)}
        onGranted={() => {
          setSelected(null);
          reload();
        }}
      />
    </div>
  );
}
