"use client";

import type { ReactNode } from "react";
import {
  AudioLines,
  Captions,
  Ear,
  Hand,
  MonitorPlay,
  Subtitles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  resolveBadges,
  type AudioKnowledge,
  type Badge,
  type BadgeGroup,
  type BadgeIcon,
  type MaturityBadgeVariant,
} from "@/lib/programme-badges";
import type { Quality } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * The Netflix/ITVX badge row: one line of pills beside the programme
 * on air, in the order the two services teach a visitor to read —
 * picture format, audio, accessibility, then the age rating.
 *
 * Every pill is painted from `resolveBadges`, which paints only what a
 * source we hold states. Quality is the catalogue's own measured feed
 * resolution; audio format, HDR and closed captions have no source and
 * are therefore absent rather than guessed. The genre is a descriptor
 * rather than a badge, so it rides along after the accessibility
 * services as a plain pill.
 *
 * An empty row is no row at all: the whole component returns null
 * rather than holding space open for a pill that never comes.
 */
export type ProgrammeBadgeRowProps = {
  /** The catalogue channel the programme airs on, when we know it. */
  channelId: string | null;
  /** The programme on air. With no title there is nothing to badge. */
  title: string | null;
  /** The measured quality of the feed, when the catalogue knows it. */
  quality?: Quality | null;
  /** The audio format a source has measured. Nothing states one today. */
  audio?: AudioKnowledge | null;
  /** Name the SD floor as well — the convention where feeds are compared. */
  showStandard?: boolean;
  className?: string;
};

/** The Lucide glyph each icon key paints with. */
const BADGE_ICONS = {
  quality: MonitorPlay,
  audio: AudioLines,
  "audio-description": Ear,
  subtitles: Subtitles,
  "sign-language": Hand,
  captions: Captions,
  maturity: UserRound,
} satisfies Record<BadgeIcon, LucideIcon>;

/** The pill each badge wears, at the micro-scale of the row. */
const PILL =
  "inline-flex h-[19px] items-center gap-1 rounded-[6px] border border-white/12 bg-white/[0.06] px-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-ink-muted backdrop-blur-sm";

/** The age rating wears a slightly stronger pill: it is the one a visitor looks for. */
const RATING_PILL =
  "inline-flex h-[19px] items-center gap-1 rounded-[6px] border border-white/14 bg-white/[0.08] px-1.5 text-[10.5px] font-semibold tabular-nums leading-none text-ink backdrop-blur-sm";

/** The genre is a descriptor, not a badge: a soft capsule with no icon. */
const GENRE_PILL =
  "inline-flex h-[19px] items-center rounded-full border border-white/12 bg-white/[0.06] px-2 text-[10.5px] font-medium leading-none tracking-[0.02em] text-ink-muted backdrop-blur-sm";

/** One icon-and-label pill. */
function BadgePill({ badge }: { badge: Badge }) {
  const Icon = BADGE_ICONS[badge.icon];

  return (
    <span
      data-slot="programme-badge"
      data-badge={badge.group}
      title={badge.title}
      aria-label={badge.accessibleName}
      className={badge.group === "maturity" ? RATING_PILL : PILL}
    >
      <Icon aria-hidden className="size-2.5" />
      <span aria-hidden>{badge.label}</span>
    </span>
  );
}

export function ProgrammeBadgeRow({
  channelId,
  title,
  quality,
  audio,
  showStandard = false,
  className,
}: ProgrammeBadgeRowProps) {
  const { badges, genre } = resolveBadges(channelId, title ?? "", quality, audio, {
    showStandard,
  });

  const of = (group: BadgeGroup) => badges.filter((badge) => badge.group === group);

  /** The rating pill is the only one that carries its reason beside it. */
  const maturityPills = badges.filter(
    (badge): badge is MaturityBadgeVariant => badge.group === "maturity",
  );

  /** The pills, in the order the row paints them: quality, audio, accessibility, genre, maturity. */
  const pills: ReactNode[] = [...of("quality"), ...of("audio"), ...of("accessibility")].map(
    (badge) => <BadgePill key={`${badge.group}-${badge.icon}`} badge={badge} />,
  );

  if (genre) {
    pills.push(
      <span
        key="genre"
        data-slot="programme-badge"
        data-badge="genre"
        className={GENRE_PILL}
      >
        {genre}
      </span>,
    );
  }

  // The rating carries its reason beside it, the way ITVX prints it:
  // "18 · violență puternică". The reason truncates before the pills
  // do — the rating is the fact, the reason is the footnote.
  for (const badge of maturityPills) {
    pills.push(
      <span
        key="maturity"
        data-slot="programme-badges-rating"
        className="flex min-w-0 items-center gap-1.5"
      >
        <BadgePill badge={badge} />
        {badge.reasons.length > 0 ? (
          <>
            <span aria-hidden className="text-ink-faint">
              ·
            </span>
            <span
              className="min-w-0 truncate text-[10.5px] leading-none text-ink-muted"
              title={badge.reasons.join(", ")}
            >
              {badge.reasons.join(", ")}
            </span>
          </>
        ) : null}
      </span>,
    );
  }

  if (pills.length === 0) return null;

  // One line: the pills, with a middot between each — the punctuation
  // ITVX uses, drawn at the faint ink so it never becomes another pill.
  const nodes: ReactNode[] = [];
  pills.forEach((pill, index) => {
    if (index > 0) {
      nodes.push(
        <span key={`sep-${index}`} aria-hidden className="text-ink-faint">
          ·
        </span>,
      );
    }
    nodes.push(pill);
  });

  return (
    <div
      data-slot="programme-badges"
      role="group"
      aria-label="Detalii program"
      className={cn("flex flex-nowrap items-center gap-x-2", className)}
    >
      {nodes}
    </div>
  );
}
