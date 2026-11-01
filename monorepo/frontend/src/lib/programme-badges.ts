import type { Quality } from "@/data/types";
import { QUALITY_META } from "@/lib/channel-meta";
import badgeData from "../../data/programme-badges.json";

/* ------------------------------------------------------------------ *
 * ITVX-style programme metadata
 *
 * `data/epg.json` carries only a title, times and a description — no
 * genre, no age rating, no accessibility flag. This module turns what we
 * can honestly know into the one shape the badge row paints: a curated
 * map (`data/programme-badges.json`) plus title heuristics, resolved in
 * that order and never inventing a value it cannot support.
 *
 * The badge vocabulary itself — the four groups, and the icon, label,
 * accessible name and tooltip each pill carries — is defined at the
 * bottom of this file and painted by
 * `src/components/programme-badges/badge-row.tsx`, so every surface
 * that badges a programme reads the same types from one place.
 *
 * Isomorphic: no React, no `fs`, no `Date`. The map is imported as a
 * module so the resolver runs unchanged on the server and in the browser.
 * ------------------------------------------------------------------ */

/** An accessibility flag, the way a broadcaster writes it on air. */
export type AccessibilityFlag = "AD" | "S" | "SSL";

/** The metadata one programme carries on to the badge row. */
export type ProgrammeBadge = {
  genre: string | null;
  rating: string | null;
  reasons: string[];
  flags: AccessibilityFlag[];
};

/** A curated channel entry. `genre` is the channel's editorial default; `flags` the accessibility it always broadcasts. */
type ChannelEntry = {
  genre?: string | null;
  flags?: string[];
};

/** A curated programme entry. A rating is only ever authored here. */
type ProgrammeEntry = {
  genre?: string | null;
  rating?: string | null;
  reasons?: string[];
  flags?: string[];
};

type BadgeFile = {
  channels?: Record<string, ChannelEntry>;
  programmes?: Record<string, ProgrammeEntry>;
};

const FLAGS: AccessibilityFlag[] = ["AD", "S", "SSL"];

/**
 * A title folded to its lookup key: lowercase, every diacritic stripped,
 * every run of separators collapsed to one space.
 *
 * It mirrors the fold the rest of the app already trusts — the
 * cedilla-to-comma repair of `diacritics()` in `now-next.tsx`, then the
 * strip of `foldKey`/`normalize` — so "Știrile Pro Tv" (comma-below),
 * "Ştirile Pro Tv" (cedilla) and "Pamantul, Soarele si tu" (bare) all
 * reach the same key.
 */
export function normalizeTitle(title: string): string {
  return (title ?? "")
    .replace(/Ş/g, "Ș")
    .replace(/ş/g, "ș")
    .replace(/Ţ/g, "Ț")
    .replace(/ţ/g, "ț")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .replace(/[ăâ]/g, "a")
    .replace(/[î]/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A channel id or slug folded the same way, but with separators removed so `pro-tv`, `protv` and `pro tv` agree. */
function foldChannel(value: string): string {
  return normalizeTitle(value).replace(/\s+/g, "");
}

/** Keep only the flags that are real ones, in the order a broadcaster writes them. */
function cleanFlags(list: string[] | undefined): AccessibilityFlag[] {
  if (!Array.isArray(list)) return [];
  return FLAGS.filter((flag) => list.includes(flag));
}

function cleanReasons(list: string[] | undefined): string[] {
  if (!Array.isArray(list)) return [];
  return list.filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0);
}

function cleanText(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/* ------------------------------------------------------------------ *
 * The indices, built once
 * ------------------------------------------------------------------ */

type ChannelIndexEntry = { genre: string | null; flags: AccessibilityFlag[] };
type ProgrammeIndexEntry = {
  genre: string | null;
  rating: string | null;
  reasons: string[];
  flags: AccessibilityFlag[];
};

const file = badgeData as unknown as BadgeFile;

const channelIndex = new Map<string, ChannelIndexEntry>();
for (const [key, entry] of Object.entries(file.channels ?? {})) {
  if (!entry || typeof entry !== "object") continue;
  channelIndex.set(foldChannel(key), {
    genre: cleanText(entry.genre ?? null),
    flags: cleanFlags(entry.flags),
  });
}

const programmeIndex = new Map<string, ProgrammeIndexEntry>();
for (const [key, entry] of Object.entries(file.programmes ?? {})) {
  if (!entry || typeof entry !== "object") continue;
  programmeIndex.set(normalizeTitle(key), {
    genre: cleanText(entry.genre ?? null),
    rating: cleanText(entry.rating ?? null),
    reasons: cleanReasons(entry.reasons),
    flags: cleanFlags(entry.flags),
  });
}

/* ------------------------------------------------------------------ *
 * Title heuristics
 *
 * Conservative on purpose: they only ever name a genre, never a rating.
 * A keyword that is common Romanian gets the benefit of the doubt; nothing
 * is guessed. When nothing matches the genre stays null and the pill is
 * simply absent.
 * ------------------------------------------------------------------ */

const GENRE_HINTS: Array<{ genre: string; words: string[] }> = [
  { genre: "Știri", words: ["stiri", "stirile", "telejurnal", "jurnal", "news", "actualitate", "informatii", "breacking", "breaking"] },
  { genre: "Sport", words: ["sport", "meci", "fotbal", "superliga", "liga", "tenis", "ciclism", "formula", "moto", "handbal", "box", "atletism", "snooker", "escalada", "echitatie", "nba", "champions", "gol", "rezumate", "derby"] },
  { genre: "Copii", words: ["desene", "desen", "draw", "cartoon", "cartoons", "animatie"] },
  { genre: "Film", words: ["film", "filmul", "cinema", "movie", "pelicula", "blockbuster", "cinemax"] },
  { genre: "Culinar", words: ["gateste", "retete", "reteta", "bucatarie", "bucataria", "bucate", "gastronomie", "chef", "mancare", "farmec culinar", "in bucate"] },
  { genre: "Documentar", words: ["documentar", "reportaj", "descoperim", "pe urmele", "istorie", "secretul", "secretele", "mistere", "natura", "aventura"] },
  { genre: "Crimă", words: ["crima", "crime", "criminal", "criminali", "criminalilor", "detectiv", "politia", "politie", "fbi", "ncis", "csi", "swat", "investigatii", "investigatie", "ucigas", "ucigasi", "cazuri", "ancheta", "anchete", "dosare", "mortii", "omor", "omoruri", "crimii"] },
  { genre: "Muzică", words: ["muzica", "muzical", "muzicale", "music", "videoclip", "hit", "clipe", "melodii", "cantec", "carusel"] },
];

/** The genre a title names, or null when it names nothing we trust. */
function genreFromTitle(title: string): string | null {
  const words = title.split(" ");
  for (const hint of GENRE_HINTS) {
    if (hint.words.some((word) => words.includes(word))) return hint.genre;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * The resolver
 * ------------------------------------------------------------------ */

const EMPTY: ProgrammeBadge = { genre: null, rating: null, reasons: [], flags: [] };

/**
 * The badge metadata for what is on a channel right now.
 *
 * Precedence, top to bottom — each level only fills what is still empty:
 *
 *   1. the exact programme entry (normalised title) — its genre, rating,
 *      reasons and any flags it lists win outright;
 *   2. the channel's own entry — its genre default and the accessibility
 *      it always broadcasts;
 *   3. a title heuristic — genre only, and only when it is sure.
 *
 * A rating is never taken from a channel default or a heuristic: if no
 * curated programme states one, there is none.
 */
export function resolveBadge(channelId: string | null, title: string): ProgrammeBadge {
  if (!title) return EMPTY;

  const program = programmeIndex.get(normalizeTitle(title)) ?? null;
  const channel = channelId ? channelIndex.get(foldChannel(channelId)) ?? null : null;

  const genre = program?.genre ?? channel?.genre ?? genreFromTitle(normalizeTitle(title)) ?? null;
  const rating = program?.rating ?? null;
  const reasons = program?.reasons ?? [];
  const flags = program && program.flags.length > 0 ? program.flags : channel?.flags ?? [];

  return { genre, rating, reasons, flags };
}

/* ------------------------------------------------------------------ *
 * The badge vocabulary
 *
 * Netflix and ITVX paint one strip of metadata beside a title: the
 * picture format, the audio format, the accessibility services and
 * the age rating, in that order, one pill each. The four groups below
 * are the whole vocabulary — the row that paints them lives in
 * `src/components/programme-badges/badge-row.tsx`.
 *
 * The rule is the one the resolver above has always followed: a badge
 * is painted only when a source we hold states it.
 *
 *   - Quality is a measurement, not a claim. The catalogue carries the
 *     resolution of every feed, so "HD" is a fact about the stream.
 *   - Audio has no source at all. The guide carries a title, times and
 *     a description; the feeds carry a resolution and an address.
 *     Dolby Atmos, Spatial Audio and 5.1 live in the vocabulary and
 *     are never emitted — an audio badge on a Romanian broadcast feed
 *     would be a guess.
 *   - Accessibility is curated, per channel and per programme, exactly
 *     as the flags above are. CC — closed captions — is vocabulary
 *     only: nothing states it, and a broadcast subtitle (S) is not the
 *     same thing.
 *   - Maturity is programme-only and curated, as it has always been.
 *     The vocabulary names both scales the product asked for: the UK's
 *     (U, PG, 12, 12A, 15, 18), which ITVX prints, and the US one
 *     (TV-Y … NC-17), which Netflix prints. A rating outside it
 *     paints nothing.
 * ------------------------------------------------------------------ */

/** The four badge groups, in the order the row paints them. */
export type BadgeGroup = "quality" | "audio" | "accessibility" | "maturity";

/**
 * The Lucide icon a badge asks for, by key.
 *
 * The resolver stays React-free — it runs on the server and in the
 * browser and imports no component — so a badge names its icon and the
 * row owns the mapping from key to glyph.
 */
export type BadgeIcon =
  | "quality"
  | "audio"
  | "audio-description"
  | "subtitles"
  | "sign-language"
  | "captions"
  | "maturity";

/** What every pill carries, whichever group it belongs to. */
type BadgeFace = {
  /** The short text painted inside the pill. */
  label: string;
  /** The full Romanian name — what a screen reader says, and the tooltip. */
  accessibleName: string;
  /** The tooltip, in full. */
  title: string;
  /** Which Lucide icon the row draws beside the label. */
  icon: BadgeIcon;
};

/** The measured picture quality of the feed the show is on right now. */
export type QualityBadgeVariant = BadgeFace & {
  group: "quality";
  /** The quality the pill names. */
  quality: Quality;
};

/**
 * The audio formats the vocabulary can name.
 *
 * None of them is knowable from any source we hold, so no channel
 * claims one. They exist here so the badge set is complete.
 */
export type AudioFormat = "atmos" | "spatial" | "surround-5-1";

/** An audio pill, on a source that has measured the feed's audio. */
export type AudioBadgeVariant = BadgeFace & {
  group: "audio";
  /** The format the pill names. */
  audio: AudioFormat;
};

/**
 * Every accessibility service the vocabulary can name.
 *
 * AD, S and SSL are the flags a broadcaster writes on air. CC —
 * closed captions — is here so the badge set is complete; nothing we
 * hold states it, and no entry in the curated file may claim it.
 */
export type AccessibilityKind = AccessibilityFlag | "CC";

/** An accessibility pill: the service, as a broadcaster writes it. */
export type AccessibilityBadgeVariant = BadgeFace & {
  group: "accessibility";
  /** The service the pill names. */
  flag: AccessibilityKind;
};

/** The age rating, spelled the way the curated file writes it. */
export type MaturityBadgeVariant = BadgeFace & {
  group: "maturity";
  /** The rating itself. */
  rating: string;
  /** Why the rating was given, when the source states it. */
  reasons: string[];
};

/** One pill of the badge row. */
export type Badge =
  | QualityBadgeVariant
  | AudioBadgeVariant
  | AccessibilityBadgeVariant
  | MaturityBadgeVariant;

/* ------------------------------------------------------------------ *
 * The pills
 * ------------------------------------------------------------------ */

/**
 * The quality pill for a feed, when its measured resolution earns one.
 *
 * The labels and the "is this badge-worthy" rule are the catalogue's
 * own (`QUALITY_META`), so the badge row, the card and the hero can
 * never disagree about what "HD" means. The standard definition is the
 * floor rather than a feature and earns no pill of its own — except on
 * a card, where feeds are compared side by side and the floor is named.
 */
export function qualityBadge(
  quality: Quality | null | undefined,
  options?: { showStandard?: boolean },
): QualityBadgeVariant | null {
  if (!quality) return null;
  const meta = QUALITY_META[quality];
  if (!meta) return null;

  const standard = quality === "sd" || quality === "low";
  if (!meta.showBadge && !(options?.showStandard && standard)) return null;

  return {
    group: "quality",
    quality,
    label: meta.label,
    accessibleName: `Calitate video: ${meta.label}`,
    title: `Calitate video: ${meta.label}`,
    icon: "quality",
  };
}

/** The audio formats, with the Romanian name each pill carries. */
const AUDIO_BADGES: Record<AudioFormat, Omit<AudioBadgeVariant, "audio">> = {
  atmos: {
    group: "audio",
    label: "Atmos",
    accessibleName: "Dolby Atmos",
    title: "Dolby Atmos",
    icon: "audio",
  },
  spatial: {
    group: "audio",
    label: "Spatial",
    accessibleName: "Spatial Audio",
    title: "Spatial Audio",
    icon: "audio",
  },
  "surround-5-1": {
    group: "audio",
    label: "5.1",
    accessibleName: "Sunet surround 5.1",
    title: "Sunet surround 5.1",
    icon: "audio",
  },
};

/** What a feed's audio can be known to be. Nothing we hold can know it. */
export type AudioKnowledge = AudioFormat | "unknown";

/**
 * The audio pill for a feed, when a source has measured it.
 *
 * The honest mapping in miniature: "unknown" — the state every feed of
 * ours is in — and "nobody has looked" both paint nothing. The day a
 * source states a format, it paints here and nowhere else.
 */
export function audioBadge(
  knowledge: AudioKnowledge | null | undefined,
): AudioBadgeVariant | null {
  if (!knowledge || knowledge === "unknown") return null;
  return { ...AUDIO_BADGES[knowledge], audio: knowledge };
}

/** The order a broadcaster writes the accessibility services in. */
const ACCESSIBILITY_ORDER: AccessibilityKind[] = ["AD", "S", "SSL", "CC"];

/** The accessibility services, with the full Romanian name each pill carries. */
const ACCESSIBILITY_BADGES: Record<
  AccessibilityKind,
  Omit<AccessibilityBadgeVariant, "flag">
> = {
  AD: {
    group: "accessibility",
    label: "AD",
    accessibleName: "Audiodescriere",
    title: "Audiodescriere",
    icon: "audio-description",
  },
  S: {
    group: "accessibility",
    label: "S",
    accessibleName: "Subtitrare",
    title: "Subtitrare",
    icon: "subtitles",
  },
  SSL: {
    group: "accessibility",
    label: "SSL",
    accessibleName: "Limbaj în semne",
    title: "Limbaj în semne",
    icon: "sign-language",
  },
  CC: {
    group: "accessibility",
    label: "CC",
    accessibleName: "Subtitrare pentru surzi",
    title: "Subtitrare pentru surzi",
    icon: "captions",
  },
};

/**
 * The accessibility pills a list of services earns, in broadcaster order.
 *
 * A service nothing sources is simply absent from the list the caller
 * holds, so this never has to guess: the vocabulary names it and the
 * data decides.
 */
export function accessibilityBadges(
  services: readonly AccessibilityKind[],
): AccessibilityBadgeVariant[] {
  return ACCESSIBILITY_ORDER.filter((kind) => services.includes(kind)).map(
    (kind) => ({ ...ACCESSIBILITY_BADGES[kind], flag: kind }),
  );
}

/**
 * The maturity scales the vocabulary names: the UK's, which ITVX
 * prints, and the US one, which Netflix prints. PG is spelled the
 * same on both.
 */
export const RATING_SCALES = {
  U: "uk",
  PG: "uk",
  "12": "uk",
  "12A": "uk",
  "15": "uk",
  "18": "uk",
  "TV-Y": "us",
  "TV-Y7": "us",
  G: "us",
  "TV-G": "us",
  "TV-PG": "us",
  "PG-13": "us",
  "TV-14": "us",
  R: "us",
  "TV-MA": "us",
  "NC-17": "us",
} as const satisfies Record<string, "uk" | "us">;

/** A rating the badge set can name. */
export type Rating = keyof typeof RATING_SCALES;

/** True when a rating is one the vocabulary names. */
export function isRating(value: string): value is Rating {
  return Object.prototype.hasOwnProperty.call(RATING_SCALES, value);
}

/**
 * The maturity pill for a programme, when a curated source states a
 * rating.
 *
 * A rating is never taken from a channel default or a heuristic, and a
 * rating the vocabulary does not name paints nothing at all — a pill
 * that means something to nobody is worse than no pill.
 */
export function maturityBadge(
  rating: string | null | undefined,
  reasons: readonly string[],
): MaturityBadgeVariant | null {
  if (!rating || !isRating(rating)) return null;

  const why = (reasons ?? []).filter(
    (reason) => typeof reason === "string" && reason.trim().length > 0,
  );

  return {
    group: "maturity",
    rating,
    reasons: why,
    label: rating,
    accessibleName: `Clasificare de vârstă: ${rating}`,
    title:
      why.length > 0
        ? `Clasificare de vârstă: ${rating} — ${why.join(", ")}`
        : `Clasificare de vârstă: ${rating}`,
    icon: "maturity",
  };
}

/* ------------------------------------------------------------------ *
 * The set
 * ------------------------------------------------------------------ */

/** One channel's badge set: the pills, in group order, plus the genre. */
export type BadgeSet = {
  /** The pills, ordered quality → audio → accessibility → maturity. */
  badges: Badge[];
  /**
   * The genre, when the programme or the channel states one. It is a
   * descriptor rather than a badge — it carries no icon and no
   * accessible name of its own — so the row paints it as a plain pill
   * between the accessibility services and the rating.
   */
  genre: string | null;
};

/**
 * The badge set for what is on a channel right now.
 *
 * Programme-level metadata comes from `resolveBadge` above, untouched:
 * the curated programme, then the channel, then the title heuristic.
 * Quality is the channel's own measured feed resolution; audio is
 * whatever a source has measured, which today is nothing.
 *
 * An empty set is a legitimate answer: a channel with no metadata
 * paints an empty row rather than an invented pill, and a channel
 * whose quality nobody measured still paints its programme badges.
 */
export function resolveBadges(
  channelId: string | null,
  title: string,
  quality?: Quality | null,
  audio?: AudioKnowledge | null,
  options?: { showStandard?: boolean },
): BadgeSet {
  const programme = resolveBadge(channelId, title);

  const badges: Badge[] = [];

  const qualityPill = qualityBadge(quality, options);
  if (qualityPill) badges.push(qualityPill);

  const audioPill = audioBadge(audio);
  if (audioPill) badges.push(audioPill);

  badges.push(...accessibilityBadges(programme.flags));

  const maturityPill = maturityBadge(programme.rating, programme.reasons);
  if (maturityPill) badges.push(maturityPill);

  return { badges, genre: programme.genre };
}
