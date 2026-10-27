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
