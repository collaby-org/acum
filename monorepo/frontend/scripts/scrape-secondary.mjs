/**
 * canaletvlive.online — second-source channel extractor.
 *
 * The catalogue of this source is not in the markup. It is a Next.js App
 * Router app: the page streams React Server Components to the browser as
 * `self.__next_f.push([1, "<flight row>"])` chunks and the channel records
 * travel inside one of those flight rows (`initialChannels`).
 *
 * This script pulls every chunk out of the homepage HTML, concatenates the
 * flight rows into one string, scans that string for JSON values and keeps
 * the records that look like channels (a `slug` plus a stream field). The
 * stream URL is read out of the structured record — never regex-matched out
 * of a blob. If the RSC payload cannot be parsed the script falls back to
 * the site's own JSON endpoint (`/api/channels`), which serves the very
 * same rows.
 *
 *   node scripts/scrape-secondary.mjs
 *
 * Writes data/secondary-sources.json — the second-source catalogue that
 * sits next to the cool-etv.net one.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = "https://canaletvlive.online";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml,application/json,*/*",
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
 * React Server Components payload
 *
 * The flight stream is a sequence of `self.__next_f.push([1, "<row>"])`
 * calls. The row strings are JSON string literals, so decoding them is a
 * plain JSON.parse. The decoded rows are concatenated: a row may be split
 * across two pushes, and the next row id may follow a previous row with no
 * newline in between.
 * ------------------------------------------------------------------ */
function flightText(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[\s*1\s*,\s*("(?:[^"\\]|\\.)*")\s*\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse(m[1]));
    } catch {
      /* a chunk we cannot decode is not fatal — the rest still parse */
    }
  }
  return chunks.join("");
}

/** Length of the balanced JSON value that starts at `start` (0 when none). */
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

/**
 * Every JSON value that can be parsed out of a flight row stream. Rows are
 * not newline-separated (a push may end mid-row), so the text is scanned
 * for balanced values instead of being split into rows.
 */
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
      // Not JSON (raw script fragments live in flight rows too). Retry from
      // the next opening brace instead of skipping the whole region.
      const next = text.slice(i + 1).search(/[{[]/);
      i = next === -1 ? text.length : i + 1 + next;
    }
  }
  return values;
}

/** Depth-first walk over every object/array node of a parsed value. */
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

/* ------------------------------------------------------------------ *
 * Record extraction
 * ------------------------------------------------------------------ */
const STREAM_KEYS = ["stream_url", "streamUrl", "stream", "embed_url", "embedUrl", "src"];
const LOGO_KEYS = ["logo", "logo_url", "logoUrl", "image", "img", "thumbnail"];

const firstString = (obj, keys) => {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

const isChannelRecord = (o) =>
  o && typeof o === "object" && !Array.isArray(o) &&
  typeof o.slug === "string" && firstString(o, STREAM_KEYS);

/** Pull every channel record out of a parsed flight payload. */
function channelRecords(values) {
  const bySlug = new Map();
  for (const value of values) {
    walk(value, (node) => {
      if (!isChannelRecord(node)) return;
      const slug = node.slug.trim();
      const prev = bySlug.get(slug);
      // Keep the richest record when the same channel shows up twice.
      if (!prev || Object.keys(node).length > Object.keys(prev).length) bySlug.set(slug, node);
    });
  }
  return [...bySlug.values()];
}

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */
const absolute = (url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? BASE + url : null;
};

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'", "#160": " ",
};

const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

const cleanText = (s) =>
  typeof s === "string"
    ? decodeEntities(s.replace(/\\[rnt]/g, " ")).replace(/\s+/g, " ").trim()
    : null;

/**
 * The source has no per-channel quality attribute: the "HD" chip on the
 * watch page is static template chrome (it is rendered for music channels
 * too). The only per-channel signal is the site's own prose, so that is
 * recorded separately and `hd` stays null.
 */
function hdClaim(description) {
  if (typeof description !== "string") return { hd: null, hdMention: false, hdEvidence: null };
  const m = /\b(full\s*hd|\buhd\b|\bhd\b)/i.exec(description);
  if (!m) return { hd: null, hdMention: false, hdEvidence: null };
  return { hd: null, hdMention: true, hdEvidence: m[0] };
}

function classifyStream(url) {
  if (!url) return "unknown";
  if (/\.m3u8(\?|$)/i.test(url)) return "hls";
  // playitforme.online serves an #EXTM3U manifest from this path.
  if (/\/api\/proxy\//i.test(url)) return "hls";
  if (/\/api\/hls\//i.test(url)) return "hls";
  if (/\/api\/ch\//i.test(url)) return "embed";
  if (/\.html?(\?|$)/i.test(url)) return "embed";
  if (/(embed|player|iframe)/i.test(url)) return "embed";
  if (/\.mp4(\?|$)/i.test(url)) return "mp4";
  return "unknown";
}

/** Drops the short-lived signed token from a stream address. */
function stripToken(value) {
  if (!value) return value;
  try {
    const url = new URL(value);
    url.searchParams.delete("token");
    return url.href;
  } catch {
    return value;
  }
}

function normalise(rec) {
  const logo = absolute(firstString(rec, LOGO_KEYS));
  const stream = absolute(firstString(rec, STREAM_KEYS));
  const description = cleanText(rec.description);
  const { hd, hdMention, hdEvidence } = hdClaim(description);
  let streamPath = null;
  try {
    if (stream) streamPath = new URL(stream).pathname;
  } catch {
    /* keep null */
  }
  return {
    id: typeof rec.id === "number" ? rec.id : null,
    slug: rec.slug.trim(),
    name: (typeof rec.name === "string" && rec.name.trim()) || rec.slug.trim(),
    logo,
    // The signed `token` parameter lives for a few minutes and is fetched
    // fresh on the server, so it is never stored: what is kept is the stable
    // path, and the token is requested again when the feed is played.
    stream: stripToken(stream),
    streamPath,
    kind: classifyStream(stream),
    hd,
    hdMention,
    hdEvidence,
    category: rec.category_name ?? rec.category ?? null,
    categorySlug: rec.category_slug ?? null,
    epgId: rec.epg_id ?? null,
    country: rec.country ?? null,
    language: rec.language ?? null,
    status: rec.status ?? null,
    description,
    sourcePage: `${BASE}/watch/${rec.slug.trim()}`,
  };
}

/* ------------------------------------------------------------------ *
 * Crawl
 * ------------------------------------------------------------------ */
async function main() {
  const home = await get(`${BASE}/`);
  const rows = flightText(home);
  console.log(`[rsc] homepage ${home.length}B — flight text ${rows.length}B`);

  let records = channelRecords(jsonValues(rows));
  let origin = "rsc:initialChannels";

  if (records.length === 0) {
    console.warn("[rsc] no channel records in the flight payload — falling back to /api/channels");
    const api = JSON.parse(await get(`${BASE}/api/channels`));
    records = api.filter(isChannelRecord);
    origin = "api:/api/channels";
  }

  const channels = records.map(normalise).sort((a, b) => a.slug.localeCompare(b.slug));
  console.log(`[channels] ${channels.length} extracted (${origin})`);

  const broken = channels.filter((c) => !c.logo || !c.stream);
  for (const c of broken) console.warn(`   ! ${c.slug} logo=${c.logo ? "ok" : "-"} stream=${c.stream ? "ok" : "-"}`);

  const kinds = {};
  for (const c of channels) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
  console.log(
    `[done] ${channels.length} channels — ${kinds.hls ?? 0} hls, ${kinds.embed ?? 0} embed, ` +
      `${kinds.unknown ?? 0} unknown, ${channels.filter((c) => c.hdMention).length} with an HD claim in the text`
  );

  const categories = new Map();
  for (const c of channels) {
    if (!c.category) continue;
    if (!categories.has(c.category)) categories.set(c.category, { name: c.category, slug: c.categorySlug, count: 0 });
    categories.get(c.category).count++;
  }

  const target = resolve(__dirname, "../data/secondary-sources.json");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(
    target,
    JSON.stringify(
      {
        source: BASE,
        generatedAt: new Date().toISOString(),
        channelCount: channels.length,
        extractedFrom: `${BASE}/`,
        payload:
          "Next.js App Router React Server Components flight payload " +
          "(self.__next_f.push chunks) — channel records read from the structured `initialChannels` array",
        notes: {
          stream:
            "HLS master/media playlist served by tv.playitforme.online/api/proxy/<uuid>. The URL carries a " +
            "short-lived signed `token` query parameter (a few minutes of life) and the endpoint only answers " +
            "when a `Referer: https://canaletvlive.online/...` header is sent — so the app has to fetch a fresh " +
            "token server-side and proxy the playlist and its segments.",
          embed:
            "kind=embed streams are player pages of the same provider (rd.playitforme.online/api/ch/<name>) or a " +
            "third-party .htm player; they are meant to be loaded in an iframe.",
          hd:
            "The source exposes no structured HD flag (the HD badge on the watch page is static template " +
            "chrome), so `hd` is null everywhere. `hdMention`/`hdEvidence` record the site's own prose claim.",
          logo: "Served from two interchangeable prefixes: /api/uploads/… and /uploads/… (WebP, JPG or PNG).",
        },
        categories: [...categories.values()].sort((a, b) => b.count - a.count),
        channels,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`[write] ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
