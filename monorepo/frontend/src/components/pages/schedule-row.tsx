import Link from "next/link";
import { formatClock, type EpgProgramme } from "@/components/now-next";
import { ChannelLogoImage } from "@/components/pages/channel-logo";
import type { Channel } from "@/data/types";
import { familyHue } from "@/lib/channel-meta";
import { cn } from "@/lib/utils";

/**
 * One line of a timetable.
 *
 * The line is a link to the channel: the player lives on the channel's own
 * page, and a timetable has no business opening a modal.
 */

/**
 * The part of a channel a line shows.
 *
 * The guide channel carries every slot of the day; a row needs a name and a
 * logo. Passing the whole thing would put the guide on the page, once per
 * channel.
 */
export type RowChannel = {
  id: string;
  name: string;
  family: string;
  familyKey: string;
  category: "generaliste" | "stiri" | "sport" | "movies" | "kids" | "documentare" | "music";
  logo: string | null;
};

/** The channel, projected down to what a line shows. */
export function rowChannel(channel: Channel): RowChannel {
  return {
    id: channel.id,
    name: channel.name,
    family: channel.family,
    familyKey: channel.familyKey,
    category: channel.category,
    logo: channel.logo,
  };
}

export type ScheduleRowProps = {
  /** The channel the line belongs to. */
  channel: RowChannel;
  /** The slot on air. */
  now: EpgProgramme | null;
  /** The slots that follow. */
  next: EpgProgramme[];
  /** How far we are through the current slot, 0..1. */
  progress: number;
  /** Minutes left of the current slot. */
  endsIn: number | null;
  /** The day's programme, when the whole day is shown. */
  day?: EpgProgramme[];
};

export function ScheduleRow({
  channel,
  now,
  next,
  progress,
  endsIn,
  day,
}: ScheduleRowProps) {
  const hue = familyHue(channel.familyKey, channel.category);

  const slots = day ?? (now ? [now, ...next] : next);

  return (
    <Link
      href={`/canal/${channel.id}`}
      className={cn(
        "group relative grid gap-x-5 gap-y-3 border-b border-white/[0.055] px-1 py-4 transition-colors duration-300 hover:bg-white/[0.025] sm:grid-cols-[minmax(0,210px)_minmax(0,1fr)] sm:items-start sm:px-3",
      )}
    >
      {/* The channel */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded-[7px] border border-white/10 bg-white/[0.06]">
          <ChannelLogoImage
            src={channel.logo}
            name={channel.name}
            className="h-full w-full object-contain p-0.5"
          />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[14.5px] font-semibold leading-tight tracking-tight text-ink">
            {channel.name}
          </p>
          <p className="mt-0.5 truncate text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">
            {channel.family}
          </p>
        </div>
      </div>

      {/* The slots */}
      <div className="min-w-0">
        {slots.length === 0 ? (
          <p className="text-[12.5px] text-ink-faint">
            Ghidul nu acoperă canalul în această perioadă.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {slots.map((programme, index) => {
              const onNow = now !== null && programme === now;
              return (
                <li key={`${programme.start}-${programme.title}-${index}`}>
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span
                      className={cn(
                        "font-mono text-[11.5px] tabular-nums",
                        onNow ? "text-signal/90" : "text-ink-faint",
                      )}
                    >
                      {formatClock(programme.start)} — {formatClock(programme.end)}
                    </span>
                    {onNow ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                        style={{
                          backgroundColor: `hsl(${hue} 80% 55% / 0.12)`,
                          color: `hsl(${hue} 92% 76%)`,
                        }}
                      >
                        <span
                          aria-hidden
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: `hsl(${hue} 92% 62%)` }}
                        />
                        Acum
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-ink-muted">
                      {programme.title}
                    </span>
                  </div>

                  {onNow ? (
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="relative h-[3px] w-full max-w-[220px] overflow-hidden rounded-full bg-white/[0.09]">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${Math.round(progress * 100)}%`,
                            background: `linear-gradient(90deg, hsl(${hue} 85% 46%), hsl(${hue} 95% 68%))`,
                            boxShadow: `0 0 14px hsl(${hue} 95% 60% / 0.55)`,
                          }}
                        />
                      </span>
                      {endsIn !== null && endsIn > 0 ? (
                        <span className="shrink-0 text-[10.5px] tabular-nums text-ink-faint">
                          {Math.ceil(endsIn)} min rămase
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Link>
  );
}
