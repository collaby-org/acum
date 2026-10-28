/**
 * The programme guide, read from the source at runtime.
 *
 * The same reader the scraper uses, so the app and the script agree on
 * what a page means: each channel's watch page carries its day inside the
 * React Server Components payload, and this module pulls the flight rows
 * out of it and normalises them to Europe/Bucharest local time with an
 * explicit offset.
 *
 * Why this lives in the app and not only in a script: the guide used to
 * be a file scraped once a day and committed, which meant a human had to
 * merge it every morning — and GitHub will not let a workflow push to a
 * protected branch or open a pull request without a permission nobody
 * gave it. Reading the source here, behind Next's own cache, makes the
 * guide keep itself: one read every cache lifetime, served to everyone.
 *
 * The committed `data/epg.json` stays as the fallback, so a source that
 * is slow or down never empties the hero.
 */

const BASE = "https://canaletvlive.online";
const TZ = "Europe/Bucharest";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** One programme, the shape the app already reads from `data/epg.json`. */
export type EpgProgramme = {
  title: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  description: string | null;
};

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */

async function get(url: string, tries = 3, as: "text" | "json" = "text") {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": UA,
          accept:
            as === "json"
              ? "application/json,*/*"
              : "text/html,application/xhtml+xml",
          referer: `${BASE}/`,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}

/* ------------------------------------------------------------------ *
 * The React Server Components payload
 * ------------------------------------------------------------------ */

/** The script chunks, decoded and joined: the page's flight data sits inside them. */
function flightText(html: string): string {
  const chunks: string[] = [];
  const re = /self\.__next_f\.push\(\[\s*1\s*,\s*("(?:[^"\\]|\\.)*")\s*\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse(m[1]));
    } catch {
      /* skip a chunk we cannot decode */
    }
  }
  return chunks.join("");
}

/** The length of the balanced object or array starting at `start`. */
function balancedLength(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i + 1 - start;
    }
  }
  return 0;
}

/** Every JSON value the text carries, decoded. */
function jsonValues(text: string): unknown[] {
  const values: unknown[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c !== "{" && c !== "[") {
      i++;
      continue;
    }
    const len = balancedLength(text, i);
    if (!len) {
      i++;
      continue;
    }
    const raw = text.slice(i, i + len);
    try {
      values.push(JSON.parse(raw));
      i += len;
    } catch {
      const next = text.slice(i + 1).search(/[{[]/);
      i = next === -1 ? text.length : i + 1 + next;
    }
  }
  return values;
}

function walk(node: unknown, visit: (value: Record<string, unknown>) => void) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (node && typeof node === "object") {
    visit(node as Record<string, unknown>);
    for (const value of Object.values(node as Record<string, unknown>)) {
      walk(value, visit);
    }
  }
}

/* ------------------------------------------------------------------ *
 * The programme rows
 * ------------------------------------------------------------------ */

/** The shape the source writes a flight in. */
type RawRow = {
  title?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  description?: unknown;
};

/** True when the row is a programme and not something else shaped like one. */
function isRow(value: Record<string, unknown>): value is Record<string, unknown> & RawRow {
  return (
    typeof value.title === "string" &&
    typeof value.start_time === "string" &&
    typeof value.end_time === "string"
  );
}

/** An ISO instant as the source writes it, in the channel's own timezone offset. */
function localIso(instant: Date): string {
  const p = localParts(instant);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${tzOffset(instant)}`;
}

/** The UTC offset Bucharest is on at an instant, as `+02:00` or `+03:00`. */
const tzOffset = (date: Date): string => {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? "");
  return m ? `${m[1]}${m[2]}:${m[3]}` : "+00:00";
};

/** The clock fields of an instant in Bucharest, as the guide stores them. */
const localParts = (date: Date): Record<string, string> =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
  "#160": " ",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d: string) =>
      String.fromCodePoint(parseInt(d, 10)),
    )
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

/** The text a description is stored with: escaped newlines flattened, spaces normalised. */
function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = decodeEntities(value.replace(/\\[rnt]/g, " ")).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

/** One raw row, or null when it is not a programme we can place in time. */
function normaliseProgramme(entry: RawRow): EpgProgramme | null {
  const starts = new Date(String(entry.start_time));
  const ends = new Date(String(entry.end_time));
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return null;

  return {
    title: clean(String(entry.title)) ?? String(entry.title),
    startsAt: localIso(starts),
    endsAt: localIso(ends),
    durationMinutes: Math.round((ends.getTime() - starts.getTime()) / 60000),
    description: clean(entry.description),
  };
}

/** Every programme row the text carries, in the order the source wrote them. */
function findEpg(text: string): EpgProgramme[] {
  const rows: EpgProgramme[] = [];
  const seen = new Set<string>();

  for (const value of jsonValues(text)) {
    walk(value, (node) => {
      if (!isRow(node)) return;
      const programme = normaliseProgramme(node);
      if (!programme) return;
      const key = `${programme.startsAt}|${programme.title}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(programme);
    });
  }

  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/* ------------------------------------------------------------------ *
 * The channel page
 * ------------------------------------------------------------------ */

/**
 * The day a channel is showing, or an empty list.
 *
 * The page first: the RSC payload carries the rows the site itself shows.
 * When the page will not answer, the site's own JSON endpoint serves the
 * same thing, and it is asked as the fallback rather than the primary
 * because it answers with an id the page does not need us to know.
 */
export async function readChannelProgrammes(
  slug: string,
): Promise<EpgProgramme[]> {
  try {
    const html = await get(`${BASE}/watch/${encodeURIComponent(slug)}`);
    const fromPage = findEpg(flightText(html));
    if (fromPage.length > 0) return fromPage;

    const json = await get(
      `${BASE}/api/epg?channel_id=${encodeURIComponent(slug)}`,
      2,
      "json",
    );
    return findEpg(json);
  } catch {
    return [];
  }
}
