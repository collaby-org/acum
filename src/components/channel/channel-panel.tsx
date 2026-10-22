/**
 * The channel panel.
 *
 * It opens with the player and asks `/api/channel/<id>` what the channel is:
 * how many people watch it, what it is about and what is on the air right
 * now. The answer arrives finished — the guide and the directory are read on
 * the server — so the panel only has to print it.
 *
 * The panel is deliberately quiet: the picture is the thing, the panel is
 * the caption under it.
 */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Eye, Radio, TrendingUp } from "lucide-react";
import { formatClock } from "@/components/now-next";
import { useMinuteTick } from "@/hooks/use-guide-clock";
import { cn } from "@/lib/utils";

/** One slot of the guide, as the endpoint prints it. */
export type PanelProgramme = {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  description: string | null;
};

/** The sheet the endpoint answers with. */
export type ChannelSheet = {
  id: string;
  name: string;
  views: number | null;
  liveViewers: number;
  category: string;
  description: string | null;
  now: PanelProgramme | null;
  next: PanelProgramme[];
};

export type ChannelPanelProps = {
  /** The catalogue id of the channel. */
  channelId: string;
  /** The name shown while the sheet is on its way. */
  channelName?: string;
  /** The family shown under the name. */
  family?: string;
  /** The channel's mark, when it has one. */
  logo?: string | null;
  /**
   * False when the surface around the panel already names the channel —
   * the player dialog does, in its own header.
   */
  showIdentity?: boolean;
  className?: string;
};

const NUMBER = new Intl.NumberFormat("ro-RO");

/**
 * Two different numbers, and the panel says which is which.
 *
 * `liveViewers` is ours: the number of browsers watching this channel here,
 * counted at the proxy over the last minute and a half. That is a crowd.
 *
 * `views` is the directory's own counter, and it is cumulative — sampled
 * twice, seventy seconds apart, it had barely moved. It is a popularity
 * ranking, and it is never dressed up as an audience.
 */
function liveLabel(count: number): string | null {
  if (!count || count <= 0) return null;
  return `${NUMBER.format(count)} în direct acum`;
}

function popularityLabel(views: number | null): string | null {
  if (views === null || views <= 0) return null;
  return `popularitate ${NUMBER.format(views)}`;
}

/** The clock of a stamp, in Romanian time. */
function clockOf(stamp: string | null): string | null {
  if (!stamp) return null;
  const moment = Date.parse(stamp);
  if (Number.isNaN(moment)) return null;
  return formatClock(moment);
}

export function ChannelPanel({
  channelId,
  channelName,
  family,
  logo,
  showIdentity = true,
  className,
}: ChannelPanelProps) {
  // The sheet belongs to the channel it was asked for: when the channel
  // changes, the old sheet is not shown under the new name.
  const [state, setState] = useState<{
    id: string;
    sheet: ChannelSheet | null;
    failed: boolean;
  }>({ id: channelId, sheet: null, failed: false });

  /**
   * The sheet is read from the server, so it is the server's clock that
   * decides what is on. The minute tick is what makes it move: once a
   * minute the panel asks again, and the answer is the programme that is on
   * air now — not the one that was on when the panel was opened.
   */
  const tick = useMinuteTick();

  useEffect(() => {
    let live = true;

    fetch(`/api/channel/${encodeURIComponent(channelId)}`)
      .then((response) => {
        if (!response.ok) throw new Error("bad status");
        return response.json() as Promise<ChannelSheet>;
      })
      .then((data) => {
        if (live) setState({ id: channelId, sheet: data, failed: false });
      })
      .catch(() => {
        if (live) setState({ id: channelId, sheet: null, failed: true });
      });

    return () => {
      live = false;
    };
  }, [channelId, tick]);

  const sheet = state.id === channelId ? state.sheet : null;
  const failed = state.id === channelId ? state.failed : false;

  const name = sheet?.name ?? channelName ?? "";
  const live = liveLabel(sheet?.liveViewers ?? 0);
  const popular = popularityLabel(sheet?.views ?? null);
  const nowClock = clockOf(sheet?.now?.startsAt ?? null);
  const nowEnd = clockOf(sheet?.now?.endsAt ?? null);

  return (
    <section
      data-slot="channel-panel"
      className={cn("flex min-w-0 flex-col gap-4", className)}
    >
      {/* Name and the mark */}
      {showIdentity ? (
        <div className="flex items-start gap-3">
          {logo ? (
            <span className="relative grid h-11 w-[60px] shrink-0 place-items-center overflow-hidden rounded-[9px] border border-white/12 bg-white/[0.06]">
              <Image
                src={logo}
                alt=""
                width={60}
                height={44}
                unoptimized
                className="size-full object-contain p-1 opacity-95"
              />
            </span>
          ) : (
            <span
              aria-hidden
              className="grid h-11 w-[60px] shrink-0 place-items-center rounded-[9px] border border-white/12 bg-white/[0.06] font-display text-sm font-bold text-ink-muted"
            >
              {name.slice(0, 2).toUpperCase()}
            </span>
          )}

          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold tracking-tight text-ink">
              {name}
            </h2>
            {family ? (
              <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                {family}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* What the directory knows */}
      {sheet ? (
        <div className="flex flex-wrap items-center gap-2">
          {sheet.category ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {sheet.category}
            </span>
          ) : null}
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-live/30 bg-live/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-live-soft">
              <Eye className="size-3" aria-hidden />
              {live}
            </span>
          ) : null}
          {popular ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              <TrendingUp className="size-3" aria-hidden />
              {popular}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* The description */}
      {sheet?.description ? (
        <p className="text-[13px] leading-relaxed text-ink-muted">
          {sheet.description}
        </p>
      ) : failed ? (
        <p className="text-[13px] leading-relaxed text-ink-faint">
          Detaliile canalului nu pot fi citite acum.
        </p>
      ) : sheet ? (
        <p className="text-[13px] leading-relaxed text-ink-faint">
          Canalul nu are o descriere.
        </p>
      ) : (
        <div className="space-y-2" aria-hidden>
          <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
        </div>
      )}

      {/* The guide */}
      {sheet?.now ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-signal/85">
            <Radio className="size-3" aria-hidden />
            Acum
          </p>
          <p className="mt-2 font-display text-[15px] font-semibold leading-tight tracking-tight text-ink">
            {sheet.now.title}
          </p>
          {nowClock ? (
            <p className="mt-1 font-mono text-[11px] tabular-nums tracking-wide text-ink-faint">
              {nowClock}
              {nowEnd ? ` — ${nowEnd}` : ""}
            </p>
          ) : null}
          {sheet.now.description ? (
            <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-ink-muted">
              {sheet.now.description}
            </p>
          ) : null}
        </div>
      ) : null}

      {sheet && sheet.next.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            Urmează
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {sheet.next.map((programme, index) => {
              const clock = clockOf(programme.startsAt);
              return (
                <li
                  key={`${programme.startsAt ?? index}-${programme.title}`}
                  className="flex min-w-0 items-baseline gap-2.5"
                >
                  {clock ? (
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-signal/85">
                      {clock}
                    </span>
                  ) : null}
                  <span className="truncate text-[13px] text-ink-muted">
                    {programme.title}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
