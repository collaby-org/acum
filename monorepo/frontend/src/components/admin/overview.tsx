/**
 * The panel: what is happening right now, and what happened.
 *
 * The live audience is ours — counted at the proxy, the same counter the
 * home page reads — and the rest comes from the database: the accounts,
 * the minutes, the paywalls, the conversions, over today and over the
 * last thirty days.
 */
"use client";

import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { DeskDenied } from "@/components/admin/denied";
import {
  Eyebrow,
  Panel,
  Pill,
  SectionTitle,
  Stat,
  formatDay,
  formatNumber,
  timeAgo,
} from "@/components/admin/parts";
import { useDeskResource } from "@/components/admin/session";
import type { OverviewPayload, Plan } from "@/components/admin/types";
import { QUALITY_META, STATUS_META } from "@/lib/channel-meta";
import { planDefinition } from "@/lib/supabase/plans";
import { cn } from "@/lib/utils";

/** The four series the desk keeps. */
const METRICS = [
  { key: "sign_ins", label: "Intrări" },
  { key: "minutes_watched", label: "Minute" },
  { key: "paywalls", label: "Paywall-uri" },
  { key: "conversions", label: "Conversii" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

/** The name a plan is shown under. */
function planLabel(plan: Plan): string {
  if (plan === "comp") return "Concediat";
  return planDefinition(plan).name;
}

export function OverviewPanel() {
  const { data, status, message, reload } = useDeskResource<OverviewPayload>(
    "/api/admin/overview",
    30_000,
  );

  if (status === "loading") return <Loading />;

  if (status !== "ok" || !data) {
    return (
      <DeskDenied
        denial={{
          status: status === "signed-out" ? "signed-out" : status === "forbidden" ? "forbidden" : status === "no-key" ? "no-key" : "error",
          message,
        }}
        onSignedIn={reload}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <LivePanel data={data} />
        <TodayPanel data={data} />
      </div>

      <SeriesPanel data={data} />

      <div className="grid gap-5 lg:grid-cols-2">
        <PlansPanel data={data} />
        <CataloguePanel data={data} />
      </div>

      <RecentPanel data={data} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The live audience
 * ------------------------------------------------------------------ */

function LivePanel({ data }: { data: OverviewPayload }) {
  const top = data.liveTop.slice(0, 8);
  const biggest = top[0]?.count ?? 0;

  return (
    <Panel className="p-6">
      <SectionTitle hint="Măsurat la proxy: câte browsere se uită acum, pe fiecare canal.">
        Audiență live
      </SectionTitle>

      <div className="mt-5 flex items-end gap-4">
        <span className="font-display text-[54px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">
          {formatNumber(data.total)}
        </span>
        <span className="mb-1.5 inline-flex items-center gap-2 text-[13px] text-ink-muted">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-live" />
          </span>
          oameni se uită acum
        </span>
      </div>

      {top.length === 0 ? (
        <p className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center text-[13px] text-ink-faint">
          Nimeni nu se uită acum. Contorul se aprinde la primul segment cerut.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {top.map((channel) => (
            <li key={channel.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13.5px] text-ink">{channel.name}</span>
                <span className="shrink-0 font-display text-[14px] font-semibold tabular-nums text-signal-bright">
                  {formatNumber(channel.count)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(242,167,27,0.55),rgba(255,201,94,0.95))] transition-[width] duration-700 ease-out"
                  style={{ width: `${biggest ? (channel.count / biggest) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Today
 * ------------------------------------------------------------------ */

function TodayPanel({ data }: { data: OverviewPayload }) {
  const today = data.today;

  return (
    <Panel className="p-6">
      <SectionTitle hint="Numerele de azi, în România.">Ziua de azi</SectionTitle>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="Conturi"
          value={formatNumber(today.accounts)}
          hint="în total"
        />
        <Stat
          label="Intrări"
          value={formatNumber(today.sign_ins)}
          hint="au intrat azi"
          accent
        />
        <Stat
          label="Minute"
          value={formatNumber(today.minutes_watched)}
          hint="de direct azi"
        />
        <Stat
          label="Paywall-uri"
          value={formatNumber(today.paywalls)}
          hint="au dat de perete"
        />
        <Stat
          label="Conversii"
          value={formatNumber(today.conversions)}
          hint="au început un plan plătit"
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Thirty days
 * ------------------------------------------------------------------ */

function SeriesPanel({ data }: { data: OverviewPayload }) {
  const [metric, setMetric] = useState<MetricKey>("sign_ins");
  const days = data.series.days;
  const peak = Math.max(1, ...days.map((day) => day[metric]));

  return (
    <Panel className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionTitle hint="Zece zile înapoi, de la stânga la dreapta.">
          Ultimele 30 de zile
        </SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setMetric(entry.key)}
              aria-pressed={metric === entry.key}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-300",
                metric === entry.key
                  ? "border-signal/45 bg-signal/12 text-signal-bright"
                  : "border-white/[0.08] bg-white/[0.03] text-ink-faint hover:border-white/20 hover:text-ink-muted",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex h-[150px] items-end gap-[3px]">
        {days.map((day) => {
          const value = day[metric];
          const height = value > 0 ? Math.max(4, (value / peak) * 100) : 2;
          const date = new Intl.DateTimeFormat("ro-RO", {
            day: "numeric",
            month: "short",
            timeZone: "Europe/Bucharest",
          }).format(new Date(`${day.day}T12:00:00Z`));

          return (
            <div
              key={day.day}
              title={`${date} · ${formatNumber(value)}`}
              className="group relative flex h-full flex-1 items-end"
            >
              <div
                className={cn(
                  "w-full rounded-t-[3px] transition-all duration-500 ease-out",
                  value > 0
                    ? "bg-[linear-gradient(180deg,rgba(255,201,94,0.95),rgba(242,167,27,0.35))] group-hover:from-signal-bright group-hover:to-signal"
                    : "bg-white/[0.06]",
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
        <span>{formatDay(days[0]?.day)}</span>
        <span>{formatDay(days[days.length - 1]?.day)}</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-5 sm:grid-cols-4">
        {METRICS.map((entry) => (
          <div key={entry.key}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
              {entry.label}
            </p>
            <p className="mt-1 font-display text-[19px] font-semibold tabular-nums text-ink">
              {formatNumber(data.series.totals[entry.key])}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * The plans
 * ------------------------------------------------------------------ */

function PlansPanel({ data }: { data: OverviewPayload }) {
  const plans = data.today.plans;
  const total = Math.max(
    1,
    plans.reduce((sum, entry) => sum + entry.count, 0),
  );

  return (
    <Panel className="p-6">
      <SectionTitle hint="Cum sunt împărțite conturile între planuri.">
        Planuri
      </SectionTitle>

      <ul className="mt-5 space-y-3.5">
        {plans.map((entry) => (
          <li key={entry.plan}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] text-ink">{planLabel(entry.plan)}</span>
              <span className="font-display text-[14px] font-semibold tabular-nums text-ink-muted">
                {formatNumber(entry.count)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(242,167,27,0.5),rgba(255,201,94,0.9))] transition-[width] duration-700 ease-out"
                style={{ width: `${(entry.count / total) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * The catalogue
 * ------------------------------------------------------------------ */

function CataloguePanel({ data }: { data: OverviewPayload }) {
  const catalogue = data.catalogue;

  return (
    <Panel className="p-6">
      <SectionTitle hint="Ce se vede pe site, în acest moment.">
        Catalog
      </SectionTitle>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Canale" value={formatNumber(catalogue.channels)} />
        <Stat label="Surse" value={formatNumber(catalogue.feeds)} />
        <Stat label="Live" value={formatNumber(catalogue.live)} accent />
        <Stat label="Cu rezervă" value={formatNumber(catalogue.withFallback)} />
      </div>

      <div className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-5">
        <Eyebrow>Calitatea măsurată</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {catalogue.quality.map((entry) => (
            <Pill key={entry.quality} tone="quiet">
              {QUALITY_META[entry.quality]?.label || entry.quality} ·{" "}
              {formatNumber(entry.count)}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {catalogue.status.map((entry) => (
            <Pill
              key={entry.status}
              tone={entry.status === "live" ? "live" : "quiet"}
            >
              {STATUS_META[entry.status]?.label ?? entry.status} ·{" "}
              {formatNumber(entry.count)}
            </Pill>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * The newest accounts
 * ------------------------------------------------------------------ */

function RecentPanel({ data }: { data: OverviewPayload }) {
  return (
    <Panel className="p-6">
      <SectionTitle hint="Conturile create în ultimul timp.">
        Înregistrări recente
      </SectionTitle>

      {data.recent.length === 0 ? (
        <p className="mt-5 text-[13px] text-ink-faint">
          Niciun cont încă. Când apare primul, apare aici.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-white/[0.06]">
          {data.recent.map((account) => (
            <li
              key={account.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ink-faint">
                <Users className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">
                  {account.display_name || account.email || "Fără e-mail"}
                </span>
                {account.email && account.display_name ? (
                  <span className="block truncate text-[12px] text-ink-faint">
                    {account.email}
                  </span>
                ) : null}
              </span>
              <Pill tone={account.plan === "free" ? "quiet" : "signal"}>
                {planLabel(account.plan)}
              </Pill>
              <span className="w-24 shrink-0 text-right text-[12px] text-ink-faint">
                {timeAgo(account.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * The wait
 * ------------------------------------------------------------------ */

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <span className="inline-flex items-center gap-3 text-[13px] text-ink-faint">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Se citesc cifrele…
      </span>
    </div>
  );
}
