/**
 * canaletvlive.online — programme guide (EPG) extractor.
 *
 * Every channel page of the source carries its own day schedule inside the
 * React Server Components payload: the watch page passes a `{channel, epg}`
 * object to its client component, where `epg` is the list of programmes
 * with absolute start/end timestamps. This script pulls those flight rows
 * out of the page HTML and normalises them to Europe/Bucharest local time
 * with an explicit offset.
 *
 * When a page cannot be read the script falls back to the site's own JSON
 * endpoint (`/api/epg?channel_id=<id>`), which serves the same rows.
 *
 *   node scripts/scrape-epg.mjs
 *
 * Writes data/epg.json — the programme guide for the second source.
 * Timestamps are absolute: the app derives "now" from them at read time.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = "https://canaletvlive.online";
const TZ = "Europe/Bucharest";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */
async function get(url, tries = 3, as = "text") {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": UA,
          accept: as === "json" ? "application/json,*/*" : "text/html,application/xhtml+xml",
          referer: `${BASE}/`,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
}

/* ------------------------------------------------------------------ *
 * React Server Components payload (same reader as scrape-secondary.mjs)
 * ------------------------------------------------------------------ */
function flightText(html) {
  const chunks = [];
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

function balancedLength(text, start) {
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

function jsonValues(text) {
  const values = [];
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

function walk(node, visit) {
  if (node === null || typeof node !== "object") return;
  visit(node);
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
  } else {
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child && typeof child === "object") walk(child, visit);
    }
  }
}

const isProgramme = (o) =>
  o && typeof o === "object" && !Array.isArray(o) &&
  typeof o.title === "string" && typeof o.start_time === "string" && typeof o.end_time === "string";

/** The longest programme list found in a parsed flight payload. */
function findEpg(values) {
  let best = null;
  for (const value of values) {
    walk(value, (node) => {
      if (Array.isArray(node)) {
        if (node.length && node.every(isProgramme) && (!best || node.length > best.length)) best = node;
        return;
      }
      const list = node.epg;
      if (Array.isArray(list) && list.length && list.every(isProgramme) && (!best || list.length > best.length)) {
        best = list;
      }
    });
  }
  return best ?? [];
}

/* ------------------------------------------------------------------ *
 * Time helpers — everything is stored in Europe/Bucharest with an offset
 * ------------------------------------------------------------------ */
const tzOffset = (date) => {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? "");
  return m ? `${m[1]}${m[2]}:${m[3]}` : "+00:00";
};

const localParts = (date) =>
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
      .map((p) => [p.type, p.value])
  );

function localIso(date) {
  const p = localParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${tzOffset(date)}`;
}

function localDate(date) {
  const p = localParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'", "#160": " ",
};

const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

const clean = (s) =>
  typeof s === "string"
    ? // The source stores some descriptions with escaped CRLF sequences
      // ("\r\r" as two characters) — flatten them before normalising spaces.
      decodeEntities(s.replace(/\\[rnt]/g, " ")).replace(/\s+/g, " ").trim()
    : null;

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */
function normaliseProgramme(entry) {
  const starts = new Date(entry.start_time);
  const ends = new Date(entry.end_time);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return null;
  return {
    title: clean(entry.title),
    startsAt: localIso(starts),
    endsAt: localIso(ends),
    durationMinutes: Math.round((ends - starts) / 60000),
    description: clean(entry.description),
  };
}

/* ------------------------------------------------------------------ *
 * Crawl
 * ------------------------------------------------------------------ */
async function main() {
  const cataloguePath = resolve(__dirname, "../data/secondary-sources.json");
  let catalogue;
  try {
    catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
  } catch {
    console.error(`[fatal] ${cataloguePath} is missing — run "node scripts/scrape-secondary.mjs" first`);
    process.exit(1);
  }

  const channels = catalogue.channels ?? [];
  console.log(`[epg] ${channels.length} channels from ${catalogue.source}`);

  const now = new Date();
  const results = [];
  const CONCURRENCY = 6;
  let cursor = 0;

  async function worker() {
    while (cursor < channels.length) {
      const channel = channels[cursor++];
      let programmes = [];
      let origin = null;
      let error = null;

      try {
        const html = await get(`${BASE}/watch/${channel.slug}`);
        programmes = findEpg(jsonValues(flightText(html)));
        if (programmes.length) origin = "rsc:watch-page";
      } catch (err) {
        error = String(err?.message || err);
      }

      if (!programmes.length && channel.id != null) {
        try {
          const raw = JSON.parse(await get(`${BASE}/api/epg?channel_id=${channel.id}`, 3, "json"));
          if (Array.isArray(raw) && raw.length) {
            programmes = raw;
            origin = "api:/api/epg";
          }
        } catch (err) {
          error = error ?? String(err?.message || err);
        }
      }

      const entries = programmes
        .map(normaliseProgramme)
        .filter(Boolean)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

      results.push({
        slug: channel.slug,
        name: channel.name,
        epgId: channel.epgId ?? null,
        origin,
        error,
        entries,
      });
      if (results.length % 10 === 0) console.log(`[epg] ${results.length}/${channels.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  /* ---- shape the guide ---- */
  const out = {};
  const withoutGuide = [];
  const fallback = [];
  const days = new Set();
  let withNow = 0;

  for (const r of results.sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (!r.entries.length) {
      withoutGuide.push(r.slug);
      continue;
    }
    if (r.origin && r.origin.startsWith("api:")) fallback.push(r.slug);
    const current = r.entries.find(
      (e) => new Date(e.startsAt) <= now && new Date(e.endsAt) >= now
    );
    const upcoming = r.entries.filter((e) => new Date(e.startsAt) > now);
    const date = current ? localDate(new Date(current.startsAt)) : localDate(new Date(r.entries[0].startsAt));
    for (const e of r.entries) days.add(localDate(new Date(e.startsAt)));
    if (current) withNow++;

    out[r.slug] = {
      date,
      name: r.name,
      epgId: r.epgId,
      // Snapshot taken at generatedAt — the app recomputes "now" from
      // `programmes`, every timestamp in this file is absolute.
      now: current
        ? { title: current.title, startsAt: current.startsAt, endsAt: current.endsAt, description: current.description }
        : null,
      next: upcoming.map((e) => ({
        title: e.title,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        description: e.description,
      })),
      programmes: r.entries,
    };
  }

  const allDays = [...days].sort();
  const target = resolve(__dirname, "../data/epg.json");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(
    target,
    JSON.stringify(
      {
        source: catalogue.source,
        generatedAt: now.toISOString(),
        timezone: TZ,
        date: allDays.includes(localDate(now)) ? localDate(now) : allDays[0] ?? null,
        days: allDays,
        channelCount: Object.keys(out).length,
        channelsWithoutGuide: withoutGuide,
        channelsFromApiFallback: fallback,
        notes: {
          coverage:
            "The source publishes one rolling day per channel: from 00:00 Europe/Bucharest of the guide " +
            "day into the early hours of the next one. `days` lists every local date the entries touch.",
          now:
            "`now` and `next` are a snapshot taken at `generatedAt`. All timestamps are absolute, so the " +
            "app should derive the currently airing programme from `programmes` at read time.",
          source:
            "Read from the `epg` array of each /watch/<slug> React Server Components payload; " +
            "/api/epg?channel_id=<id> is the fallback for pages that cannot be read.",
        },
        channels: out,
      },
      null,
      2
    ),
    "utf8"
  );

  const entries = Object.values(out).reduce((n, c) => n + c.programmes.length, 0);
  console.log(
    `[done] ${Object.keys(out).length}/${channels.length} channels with a guide — ${entries} programmes, ` +
      `${withNow} airing now, ${withoutGuide.length} without a guide, ${fallback.length} via the API fallback`
  );
  if (withoutGuide.length) console.log(`   channels without a guide: ${withoutGuide.join(", ")}`);
  console.log(`[write] ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
