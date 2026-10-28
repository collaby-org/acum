import Link from "next/link";
import { ChannelLogoImage } from "@/components/pages/channel-logo";
import type { CategoryId, Channel, Quality, ServerStatus } from "@/data/types";
import { familyHue } from "@/lib/channel-meta";
import { cn } from "@/lib/utils";

/**
 * A channel, as a link.
 *
 * The app's card is a button: it opens the player in place. A content page
 * does not own a player, so the same channel is a **link** here — to the
 * channel's own page, where the player lives. That keeps the two surfaces
 * honest about what they do.
 */

/**
 * The part of a channel the tile shows.
 *
 * The catalogue channel carries its feed stack and its counters; none of
 * that belongs in a tile, and a page with a hundred tiles would carry it
 * all the way down to the browser for nothing.
 */
export type TileChannel = {
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
};

/** The channel, projected down to what the tile draws. */
export function tileChannel(channel: Channel): TileChannel {
  return {
    id: channel.id,
    name: channel.name,
    family: channel.family,
    familyKey: channel.familyKey,
    category: channel.category,
    logo: channel.logo,
    logoHd: channel.logoHd,
    logoDark: channel.logoDark,
    status: channel.status,
    quality: channel.quality,
  };
}

export type ChannelTileProps = {
  channel: TileChannel;
  /** What is on right now, when the guide covers the channel. */
  now?: string | null;
  /** The time the current slot runs until, already formatted. */
  until?: string | null;
  /** A note under the name — the family, or why the channel is listed. */
  note?: string;
  className?: string;
};

export function ChannelTile({
  channel,
  now,
  until,
  note,
  className,
}: ChannelTileProps) {
  const hue = familyHue(channel.familyKey, channel.category);
  const live = channel.status === "live";

  return (
    <Link
      href={`/canal/${channel.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-[var(--radius-card)] border border-white/[0.07] bg-white/[0.03] p-3.5 transition-[transform,border-color,background-color,box-shadow] duration-[420ms] ease-spring hover:-translate-y-1 hover:border-white/16 hover:bg-white/[0.055] hover:shadow-[var(--shadow-e3)] focus-visible:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
    >
      {/* The family's own light, rimming the card. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px -z-10 rounded-[calc(var(--radius-card)_+_2px)] opacity-0 transition-opacity duration-[600ms] group-hover:opacity-40 motion-reduce:transition-none"
        style={{
          background: `radial-gradient(120% 90% at 0% 0%, hsl(${hue} 92% 58% / 0.4) 0%, transparent 58%)`,
        }}
      />

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "relative grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded-[7px] border",
            channel.logoDark
              ? "border-white/20 bg-white/92"
              : "border-white/10 bg-white/[0.06]",
          )}
        >
          <ChannelLogoImage
            src={
              channel.quality && ["hd", "fhd", "uhd"].includes(channel.quality)
                ? (channel.logoHd ?? channel.logo)
                : channel.logo
            }
            name={channel.name}
            className="h-full w-full object-contain p-0.5"
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[14.5px] font-semibold leading-tight tracking-tight text-ink">
            {channel.name}
          </p>
          <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            {note ?? channel.family}
          </p>
        </div>

        <span
          className={cn(
            "flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-black/45 px-2 backdrop-blur-md",
            live ? "" : "opacity-60",
          )}
          title={live ? "Live" : channel.status}
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              live ? "bg-live" : "bg-white/30",
            )}
          />
          <span
            className={cn(
              "text-[9.5px] font-bold uppercase tracking-[0.14em]",
              live ? "text-live-soft" : "text-ink-faint",
            )}
          >
            {live ? "Live" : "—"}
          </span>
        </span>
      </div>

      <p className="mt-3 flex min-w-0 items-baseline gap-2">
        {now ? (
          <>
            <span
              className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em]"
              style={{ color: `hsl(${hue} 85% 72%)` }}
            >
              Acum
            </span>
            <span className="min-w-0 truncate text-[12px] leading-tight text-ink-muted">
              {now}
            </span>
          </>
        ) : (
          <span className="min-w-0 truncate text-[11px] uppercase tracking-[0.1em] text-ink-faint">
            Fără program în ghid
          </span>
        )}
      </p>

      {until ? (
        <p className="mt-1 font-mono text-[10.5px] tabular-nums text-ink-faint">
          până la {until}
        </p>
      ) : null}
    </Link>
  );
}
