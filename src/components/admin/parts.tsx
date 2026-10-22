/**
 * The desk's small parts.
 *
 * The same visual language as the product: near-black surfaces, a hairline
 * where a surface has to separate, a lit edge on top, and one accent —
 * the broadcast gold. Nothing here is a page; the pages put these together.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A surface. The lit top edge is what makes it read as glass. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[18px] border border-white/[0.07]",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))]",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_24px_56px_-34px_rgba(0,0,0,0.95)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** The small label above a number. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.22em] text-signal/85",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** The heading of a section. */
export function SectionTitle({
  children,
  hint,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em] text-ink">
          {children}
        </h2>
        {hint ? (
          <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">{hint}</p>
        ) : null}
      </div>
      {hint && typeof hint !== "string" ? hint : null}
    </div>
  );
}

/** A number, with its label and a line under it. */
export function Stat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-display text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums",
          accent ? "text-signal-bright" : "text-ink",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/** The tones a chip can carry. */
export type PillTone = "neutral" | "signal" | "live" | "quiet";

const PILL_TONES: Record<PillTone, string> = {
  neutral: "border-white/12 bg-white/[0.06] text-ink-muted",
  signal: "border-signal/35 bg-signal/12 text-signal-bright",
  live: "border-live/35 bg-live/12 text-[#ff8b93]",
  quiet: "border-white/8 bg-white/[0.03] text-ink-faint",
};

/** A small chip. */
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium tracking-tight",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A row of the tables. */
export function TableShell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[14px] border border-white/[0.07] bg-[#07080e]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The head of a table. */
export function Th({
  children,
  className,
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** A cell of a table. */
export function Td({
  children,
  className,
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle text-[13px] text-ink-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** A number, written the Romanian way. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ro-RO").format(Math.round(value));
}

/** A date and a time, in Romanian. */
export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Bucharest",
  }).format(date);
}

/** A date, in Romanian. */
export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeZone: "Europe/Bucharest",
  }).format(date);
}

/** A day of the series, in Romanian: "23 sept.". */
export function formatDay(day: string | null): string {
  if (!day) return "";
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Bucharest",
  }).format(date);
}

/** How long ago a moment was, in plain Romanian. */
export function timeAgo(value: string | null): string {
  if (!value) return "niciodată";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "chiar acum";
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `acum ${minutes} min`;
  }
  if (seconds < 86_400) {
    const hours = Math.floor(seconds / 3600);
    return `acum ${hours} h`;
  }
  const days = Math.floor(seconds / 86_400);
  if (days < 30) return `acum ${days} z`;
  return formatDate(value);
}
