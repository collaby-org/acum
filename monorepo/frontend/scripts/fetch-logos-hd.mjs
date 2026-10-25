/**
 * HD channel logo fetcher.
 *
 * The upstream directory only publishes 40x20 PNGs — far too soft for the
 * grid. This script pulls a real, high-resolution, transparent-background logo
 * for every channel and writes it next to the originals:
 *
 *   public/logos/<slug>.png      base logo, trimmed, transparent
 *   public/logos/<slug>-hd.png   the channel's own HD lockup, when it has one
 *   data/logo-index.json         one record per channel: files, source, size
 *
 * <slug> is the channel id the app already uses (the taxonomy name, slugified
 * the same way scripts/build-dataset.mjs slugifies it), so the UI can address
 * /logos/<slug>.png without a second lookup table.
 *
 * Where the logos come from, in order of trust:
 *
 *   1. the channel's own Wikipedia article — the infobox logo is the logo the
 *      channel itself put on Wikipedia, so it cannot be the wrong channel
 *   2. Wikimedia Commons — a matching file (usually an SVG, i.e. resolution
 *      independent) found by title search
 *   3. the upstream directory's 40x20 PNG — the fallback; it is copied under
 *      the slug name but never mistaken for a real logo (the record says so)
 *
 * A logo is only accepted when its title names the channel it is filed under.
 * The longest channel name that appears in the title wins, so PRO TV never
 * picks up "PRO TV Chișinău", Kanal D never picks up "Kanal D 2", and
 * Filmbox never picks up "FILMBOX+ Stream".
 *
 *   node scripts/fetch-logos-hd.mjs [--force] [--dry-run] [--verbose]
 *                                  [--only=slug,slug]
 *
 * Without --force a channel that already has a good logo is left alone.
 * --force re-downloads everything; a good logo is still never replaced by a
 * worse one (smaller, or opaque where the old one was transparent).
 */
import { writeFile, mkdir, readFile, access, copyFile } from "node:fs/promises";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LOGO_DIR = resolve(ROOT, "public/logos");
const INDEX_FILE = resolve(ROOT, "data/logo-index.json");
const TAXONOMY = resolve(__dirname, "channel-taxonomy.json");
const RAW = resolve(ROOT, "data/channels.raw.json");

const WIKI_HOSTS = ["ro.wikipedia.org", "en.wikipedia.org"];
const COMMONS = "commons.wikimedia.org";
const UPSTREAM = "https://www.cool-etv.net";

/** Width the vector logos are rasterised to — 5x the widest on-screen use. */
const RASTER_WIDTH = 1024;
/** Nothing is stored wider than this; the cards are far smaller. */
const MAX_WIDTH = 2048;
/** A stored logo must be at least this wide to count as "good". */
const GOOD_WIDTH = 200;
/** How many channels are looked up at a time. */
const BATCH_SIZE = 24;
/** How many requests may be in flight. */
const CONCURRENCY = 6;

const UA =
  "ACUM-logo-fetch/1.0 (https://github.com/collaby-org/acum; romanian-tv-live catalogue builder) Node/" +
  process.version;

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const DRY_RUN = argv.includes("--dry-run");
const VERBOSE = argv.includes("--verbose");
const ONLY = argv.find((a) => a.startsWith("--only="))?.slice(7)?.split(",") ?? null;

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */
const MIN_GAP_MS = 60;
let lastStart = 0;

async function get(url, { tries = 4, accept = "*/*" } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const wait = MIN_GAP_MS - (Date.now() - lastStart);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastStart = Date.now();
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept },
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        await new Promise((r) => setTimeout(r, retryAfter || 1500 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("request failed");
}

async function api(host, params) {
  const url = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await get(url.href, { accept: "application/json" });
  return res.json();
}

/** Runs `worker` over `items` with a fixed number of workers. */
async function pool(items, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        await worker(item);
      } catch {
        /* one failure must not stop the batch */
      }
    }
  });
  await Promise.all(runners);
}

const chunks = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/* ------------------------------------------------------------------ *
 * Names
 * ------------------------------------------------------------------ */
const fold = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șț]/g, (c) => (c === "ș" ? "s" : "t"));

const words = (s) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/** Words of a Commons file title, without the File: namespace prefix. */
const titleWords = (title) => words(String(title).replace(/^[^:]*:\s*/, ""));

/** URL-safe id: diacritics folded, everything else alphanumeric. */
const slugify = (name) =>
  fold(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Words that say nothing about which channel a logo belongs to. */
const GENERIC = new Set(["tv", "television", "televiziune", "canal", "canale", "plus", "ultra", "live"]);

/** Distinctive words of a channel name — the ones a logo title must carry. */
const distinctive = (name) => words(name).filter((w) => !GENERIC.has(w));

/** Common nouns that make a one-word channel name too easy to hit. */
const GENERIC_NAMES = new Set([
  "movies",
  "news",
  "sports",
  "sport",
  "music",
  "kids",
  "family",
  "show",
  "life",
  "love",
  "play",
  "action",
  "cinema",
  "series",
  "classic",
  "extra",
  "gold",
  "junior",
  "premium",
  "one",
  "world",
]);

const isDigit = (w) => /^\d+$/.test(w);

/** The words of a name without its number — the brand behind the channel. */
const baseWords = (name) => words(name).filter((w) => !isDigit(w));
const compact = (ws) => ws.join("");

/** The words that name the brand, without the generic ones and the number. */
const coreWords = (name) => words(name).filter((w) => !GENERIC.has(w) && !isDigit(w));

/** True when `seq` appears as a consecutive run inside `tokens`. */
const hasRun = (tokens, seq) => {
  if (!seq.length) return false;
  outer: for (let i = 0; i + seq.length <= tokens.length; i++) {
    for (let j = 0; j < seq.length; j++) if (tokens[i + j] !== seq[j]) continue outer;
    return true;
  }
  return false;
};

/* ------------------------------------------------------------------ *
 * Channels
 * ------------------------------------------------------------------ */
const taxonomy = JSON.parse(await readFile(TAXONOMY, "utf8"));
const raw = JSON.parse(await readFile(RAW, "utf8"));

const feedBySlug = new Map();
for (const feed of raw.channels) if (!feedBySlug.has(feed.slug)) feedBySlug.set(feed.slug, feed);

/** The upstream 40x20 file for a feed, e.g. /logos/mbico_mb5czm_1.png */
const upstreamFile = (feed) => {
  if (!feed?.icon) return null;
  return `/logos/${basename(new URL(feed.icon).pathname)}`;
};

const usedIds = new Set();
const channels = [];
for (const family of Object.values(taxonomy.families)) {
  for (const channel of family.channels) {
    const servers = channel.servers.map((s) => s.slug);
    let id = slugify(channel.name) || slugify(family.name) || "channel";
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    usedIds.add(id);
    channels.push({
      id,
      name: channel.name,
      family: family.name,
      servers,
      fallbackFile: upstreamFile(feedBySlug.get(servers[0])) ?? null,
    });
  }
}

/** Every channel name, so a logo cannot be mixed up with another channel. */
const nameRuns = channels.map((c) => ({ channel: c, seq: words(c.name) }));

/**
 * How a channel relates to the other channels of its family.
 *
 *   series   the numbered channels of the same brand (SuperSport 1 and 2)
 *   variant  the word that makes a channel a variant of another one
 *            (Acasa Gold is Acasa with a "gold" in the name)
 */
const familyOf = new Map();
for (const channel of channels) {
  const core = compact(coreWords(channel.name));
  const series = channels.filter(
    (o) => o.family === channel.family && compact(coreWords(o.name)) === core,
  );
  const variant = new Set();
  for (const other of channels) {
    if (other.family !== channel.family) continue;
    const mine = new Set(coreWords(channel.name));
    const theirs = new Set(coreWords(other.name));
    if (theirs.size < mine.size && [...theirs].every((w) => mine.has(w))) {
      for (const w of mine) if (!theirs.has(w)) variant.add(w);
    }
  }
  familyOf.set(channel.id, {
    series,
    variant: [...variant],
    digits: new Set(series.flatMap((o) => words(o.name).filter(isDigit))),
    own: words(channel.name).filter(isDigit),
  });
}

/**
 * Which channel does a Commons file title belong to?
 *
 * The longest channel name that appears in the title wins: "Kanal D 2" beats
 * "Kanal D", so a file titled "Kanal D 2 logo.svg" belongs to Kanal D 2.
 */
function matchScore(channel, title) {
  const tokens = titleWords(title);
  let best = null;
  for (const { channel: other, seq } of nameRuns) {
    if (!seq.length || !hasRun(tokens, seq)) continue;
    if (!best || seq.length > best.seq.length) best = { channel: other, seq };
  }
  if (best) return best.channel.id === channel.id ? 1 : -1;
  // No full name in the title: the brand has to be there, written the way the
  // channel writes it ("LOOK Sport" is filed as "LookSport").
  const brand = compact(baseWords(channel.name));
  if (brand && compact(tokens).includes(brand)) return 1;
  return distinctive(channel.name).some((w) => tokens.includes(w)) ? 1 : -1;
}

/* ------------------------------------------------------------------ *
 * Wikimedia
 * ------------------------------------------------------------------ */
const fileTitle = (rawTitle) => {
  const t = decodeURIComponent(rawTitle).replace(/_/g, " ").trim();
  const withNs = t.replace(/^(Fișier| Fisier|FiŞier)[:\s]+/i, "File:");
  return withNs.includes(":") ? withNs.replace(/\s+/g, " ") : `File:${withNs}`;
};

/** Commons normalises the title it echoes back; compare on this key. */
const fileKey = (title) =>
  String(title)
    .replace(/^File:\s*/i, "File:")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * The logo each article shows in its infobox.
 *
 * Romanian articles use the Infocaseta template, whose logo parameter is
 * called fisier_logo; the English ones use logo.
 */
async function wikipediaLogoTitles(host, names) {
  const out = new Map();
  for (const chunk of chunks(names, 40)) {
    const res = await api(host, {
      action: "query",
      format: "json",
      formatversion: "2",
      redirects: "1",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: chunk.join("|"),
    });
    const back = new Map();
    for (const n of res.query?.normalized ?? []) back.set(n.to, n.from);
    for (const r of res.query?.redirects ?? []) back.set(r.to, r.from);
    const original = (title) => {
      let t = title;
      for (let i = 0; i < 5 && back.has(t); i++) t = back.get(t);
      return t;
    };
    for (const page of res.query?.pages ?? []) {
      if (page.missing) continue;
      const text = page.revisions?.[0]?.slots?.main?.content ?? "";
      const m = text.match(/\|\s*(?:fisier_logo|logo(?:_file)?|logo2)\s*=\s*([^\n|}]+)/i);
      if (!m) continue;
      const inner = m[1].match(/\[\[\s*([^\]|]+)/);
      const title = fileTitle(inner ? inner[1] : m[1]);
      if (!/\.(svg|png|webp)$/i.test(title)) continue;
      out.set(original(page.title), title);
    }
  }
  return out;
}

/** Image information for a batch of Commons files. */
async function commonsInfos(titles) {
  const out = new Map();
  for (const chunk of chunks([...new Set(titles)], 40)) {
    const res = await api(COMMONS, {
      action: "query",
      format: "json",
      formatversion: "2",
      titles: chunk.join("|"),
      prop: "imageinfo",
      iiprop: "url|size|mime",
      iiurlwidth: String(RASTER_WIDTH),
    });
    for (const page of res.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      out.set(fileKey(page.title), {
        title: page.title,
        url: info.url,
        thumbUrl: info.thumburl ?? info.url,
        width: info.width,
        height: info.height,
        mime: info.mime,
        pageUrl: `https://${COMMONS}/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
      });
    }
  }
  return out;
}

/** Commons files whose title matches a query. */
async function commonsSearch(query, limit = 20) {
  const res = await api(COMMONS, {
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|size|mime",
  });
  return Object.values(res.query?.pages ?? []).map((page) => {
    const info = page.imageinfo?.[0] ?? {};
    return {
      title: page.title,
      url: info.url,
      thumbUrl: info.thumburl ?? info.url,
      width: info.width,
      height: info.height,
      mime: info.mime,
      pageUrl: `https://${COMMONS}/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    };
  });
}

const isDrawing = (c) => c.mime === "image/svg+xml";
const isBitmap = (c) => c.mime === "image/png" || c.mime === "image/webp";
const isLogoShaped = (c) => c.width / c.height >= 0.7 && c.width / c.height <= 12;
const hasHdMarker = (c) => /\bhd\b/i.test(fold(c.title).replace(/[^a-z0-9]+/g, " "));

/** Words a Commons file title may carry without naming a different product. */
const TITLE_NOISE = new Set([
  "logo",
  "logos",
  "logotype",
  "wordmark",
  "brand",
  "brandmark",
  "mark",
  "symbol",
  "emblem",
  "present",
  "official",
  "the",
  "of",
  "and",
  "for",
  "new",
  "old",
  "original",
  "current",
  "version",
  "outline",
  "flat",
  "text",
  "mono",
  "monochrome",
  "solid",
  "simple",
  "clean",
  "full",
  "square",
  "circle",
  "icon",
  "banner",
  "horizontal",
  "vertical",
  "stacked",
  "compact",
  "wide",
  "cmyk",
  "png",
  "svg",
  "jpg",
  "jpeg",
  "webp",
  "transparent",
  "white",
  "black",
  "colour",
  "color",
  "red",
  "blue",
  "green",
  "yellow",
  "grey",
  "gray",
  "ro",
  "hd",
  "sd",
  "fhd",
  "uhd",
  "tv",
  "plus",
]);

const isYear = (w) => /^(19|20)\d{2}$/.test(w);
const DATED_RANGE = /\b(19|20)\d{2}\s*[-–—]\s*(19|20)?\d{2}\b/;

/** Title words that name something the channel name does not. */
function unexplainedWords(channel, title) {
  const allowed = new Set([
    ...TITLE_NOISE,
    ...words(channel.name),
    compact(baseWords(channel.name)),
  ]);
  return titleWords(title).filter((w) => !allowed.has(w) && !isYear(w));
}

/**
 * A title that spells the brand the way another channel does.
 *
 * "Cinemáx" is the Spanish channel, "Cinemax" is not — the diacritic is the
 * only difference, so the check looks at the title as it is written.
 */
function foreignSpelling(channel, title) {
  if (/[^\x00-\x7F]/.test(channel.name)) return false;
  const own = String(channel.name)
    .split(/[^A-Za-z0-9À-ɏ]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  const brand = new Set(baseWords(channel.name));
  return String(title)
    .split(/[^A-Za-zÀ-ɏ]+/)
    .filter(Boolean)
    .some((raw) => brand.has(fold(raw)) && !own.includes(raw.toLowerCase()));
}

/** The numbered siblings of a channel, e.g. LOOK Sport 1 and LOOK Sport 2. */
function numberedFamily(channel) {
  const family = familyOf.get(channel.id);
  if (!family?.own.length) return null;
  const numbered = family.series.filter((o) => words(o.name).some(isDigit));
  return { ...family, shared: numbered.length > 1 };
}

/**
 * A candidate is usable when its title really names this channel.
 */
function rejectReason(channel, candidate) {
  if (!isDrawing(candidate) && !isBitmap(candidate)) return "not a vector or png";
  if (!isLogoShaped(candidate)) return "wrong shape";
  if (matchScore(channel, candidate.title) !== 1) return "belongs to another channel";
  const extra = unexplainedWords(channel, candidate.title);
  if (extra.length) return `names ${extra.join(", ")}`;
  if (foreignSpelling(channel, candidate.title)) return "a different spelling";
  const family = numberedFamily(channel);
  if (family) {
    const digits = titleWords(candidate.title).filter(isDigit);
    const wrong = digits.filter((d) => family.digits.has(d) && !family.own.includes(d));
    if (wrong.length) return `is ${wrong[0]}`;
    if (!digits.some((d) => family.own.includes(d)) && !family.shared) return "is another number";
  }
  const variant = familyOf.get(channel.id)?.variant ?? [];
  const missing = variant.filter((w) => !titleWords(candidate.title).includes(w));
  if (missing.length) return `no "${missing[0]}" in the title`;
  // A common one-word channel name is too easy to hit by accident.
  const own = distinctive(channel.name);
  if (own.length === 1 && GENERIC_NAMES.has(own[0])) return "the name is too common";
  return null;
}

const usable = (channel, candidate) => rejectReason(channel, candidate) === null;

/** The newest year a title mentions — a logo version, not a photo. */
const newestYear = (title) => {
  const years = [...String(title).matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  return years.length ? Math.max(...years) : 0;
};

/**
 * How good a candidate is.
 *
 * The infobox logo wins outright — the channel itself put it on Wikipedia.
 * After that a file marked "present" (the current branding) beats an older
 * one, the most recent logo version beats the one before it, a vector beats a
 * raster, and a title that names an unrelated product (FILMBOX+ Stream for
 * Filmbox) is pushed down.
 */
function candidateRank(channel, candidate) {
  const flat = fold(candidate.title).replace(/[^a-z0-9]+/g, " ");
  let rank = 0;
  if (candidate.origin === "wikipedia-infobox") rank += 10000;
  if (/\bpresent\b/.test(flat)) rank += 800;
  if (/\blogos?\b/.test(flat)) rank += 100;
  if (DATED_RANGE.test(candidate.title)) rank -= 400;
  const year = newestYear(candidate.title);
  if (year) rank += (year - 2000) * 3;
  rank -= unexplainedWords(channel, candidate.title).length * 120;
  if (isDrawing(candidate)) rank += 50;
  const family = numberedFamily(channel);
  if (family && titleWords(candidate.title).some((w) => family.own.includes(w))) rank += 300;
  rank += Math.min(candidate.width, 4000) / 100;
  return rank;
}

/* ------------------------------------------------------------------ *
 * Downloading and normalising
 * ------------------------------------------------------------------ */
const download = async (url) => {
  const res = await get(url, { accept: "image/*" });
  const type = res.headers.get("content-type") ?? "";
  if (type && !type.startsWith("image/")) throw new Error(`not an image (${type})`);
  return Buffer.from(await res.arrayBuffer());
};

/**
 * Rasterise to a transparent PNG.
 *
 * SVG is rendered locally, at least RASTER_WIDTH wide and never larger than
 * the drawing itself, so the result is a real vector rendering rather than a
 * scaled-up thumbnail. Raster sources are never enlarged, and a vector too
 * big to render is taken from Wikimedia's own renderer instead.
 */
async function toPng(buffer, mime, thumbUrl) {
  if (mime === "image/svg+xml") {
    const meta = await sharp(buffer).metadata();
    const width = meta.width || RASTER_WIDTH;
    const density = Math.max(72, Math.min(1200, Math.round((RASTER_WIDTH / width) * 72)));
    const pixels = width * (density / 72) * (meta.height * (density / 72));
    if (pixels > 40e6 && thumbUrl) {
      // Too big to render here: let Wikimedia do it.
      const rendered = Buffer.from(
        await fetch(thumbUrl, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60000) }).then(
          (r) => r.arrayBuffer(),
        ),
      );
      return finish(rendered);
    }
    return finish(await sharp(buffer, { density }).png({ compressionLevel: 9 }).toBuffer());
  }
  return finish(await sharp(buffer).png({ compressionLevel: 9 }).toBuffer());
}

/** Trims the artwork and measures it. */
async function finish(png) {
  // Transparency is judged on the untrimmed render: after trimming, the corner
  // pixel belongs to the artwork, not to the background.
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const transparent = data[3] < 250;

  let trimmed = png;
  try {
    trimmed = await sharp(png).trim({ threshold: 8 }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    /* a fully transparent or untrimable image is kept as it is */
  }
  let out = await sharp(trimmed).metadata();
  if (out.width > MAX_WIDTH) {
    trimmed = await sharp(trimmed)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    out = await sharp(trimmed).metadata();
  }
  return { buffer: trimmed, width: out.width, height: out.height, transparent };
}

/**
 * Reads what is on disk.
 *
 * The artwork's brightness is measured here, on the stored file: a black logo
 * needs a light plate on a dark app, and the app has to know.
 */
async function inspect(file) {
  try {
    await access(file);
    const meta = await sharp(file).metadata();
    const { data } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      count++;
    }
    return { width: meta.width, height: meta.height, dark: count ? sum / count < 50 : false };
  } catch {
    return null;
  }
}

/**
 * How good a stored logo is.
 *
 * A transparent background is worth more than resolution, but not so much
 * that a soft logo beats a sharp one: 1500 for the alpha, then the width.
 */
const quality = (width, transparent) => (transparent ? 1500 : 0) + Math.min(width, 4000) / 2;


/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */
const previous = await readFile(INDEX_FILE, "utf8")
  .then((t) => JSON.parse(t))
  .catch(() => ({ channels: {} }));

await mkdir(LOGO_DIR, { recursive: true });

const targets = ONLY
  ? channels.filter((c) => ONLY.includes(c.id) || ONLY.includes(c.name))
  : channels;
if (!targets.length) {
  console.error(`[logos] no channel matches "${ONLY}"`);
  process.exit(1);
}

const records = {};
let fetched = 0;
let kept = 0;
let fallbacks = 0;
let hdCount = 0;
let failed = 0;

/** Collects the candidates of every channel in a batch. */
async function gather(batch) {
  const names = batch.map((c) => c.name);
  const wanted = new Map();
  for (const host of WIKI_HOSTS) {
    let titles = new Map();
    try {
      titles = await wikipediaLogoTitles(host, names);
    } catch {
      continue;
    }
    for (const [name, title] of titles) {
      const channel = batch.find((c) => c.name === name);
      if (!channel) continue;
      if (!wanted.has(channel.id)) wanted.set(channel.id, []);
      wanted.get(channel.id).push(title);
    }
  }
  const infos = wanted.size ? await commonsInfos([...wanted.values()].flat()) : new Map();
  const infobox = new Map();
  for (const [id, titles] of wanted) {
    for (const title of titles) {
      const info = infos.get(fileKey(title));
      if (info) {
        infobox.set(id, { ...info, kind: "base", origin: "wikipedia-infobox" });
        break;
      }
    }
  }

  const hits = new Map(batch.map((c) => [c.id, []]));
  const searches = [];
  for (const channel of batch) {
    // The brand as one word: "LOOK Sport" is filed as "LookSport".
    const brand = compact(baseWords(channel.name));
    searches.push(
      { channel, kind: "base", query: `intitle:"${channel.name}" filetype:drawing` },
      { channel, kind: "base", query: `intitle:"${channel.name}" filetype:bitmap` },
      { channel, kind: "base", query: `"${channel.name}" logo filetype:drawing` },
      { channel, kind: "base", query: `"${channel.name}" logo filetype:bitmap` },
    );
    if (brand && brand !== channel.name.toLowerCase().replace(/[^a-z0-9]+/g, "")) {
      searches.push(
        { channel, kind: "base", query: `intitle:${brand} filetype:drawing` },
        { channel, kind: "base", query: `intitle:${brand} filetype:bitmap` },
      );
    }
    searches.push(
      { channel, kind: "hd", query: `intitle:"${channel.name} HD" filetype:drawing` },
      { channel, kind: "hd", query: `"${channel.name}" HD logo filetype:drawing` },
    );
    if (brand) searches.push({ channel, kind: "hd", query: `intitle:${brand} HD filetype:drawing` });
  }
  await pool(searches, async ({ channel, kind, query }) => {
    let found = [];
    try {
      found = await commonsSearch(query);
    } catch {
      return;
    }
    const list = hits.get(channel.id);
    for (const hit of found) {
      if (list.some((c) => c.title === hit.title && c.kind === kind)) continue;
      list.push({ ...hit, kind, origin: "wikimedia-commons" });
    }
  });

  const candidates = new Map();
  for (const channel of batch) {
    const list = hits.get(channel.id);
    const wiki = infobox.get(channel.id);
    if (wiki) list.push(wiki);
    candidates.set(channel.id, list);
  }
  return candidates;
}

/** Writes the logo of one channel and records where it came from. */
async function store(channel, candidate, record) {
  const png = await toPng(await download(candidate.url), candidate.mime, candidate.thumbUrl);
  if (png.width < GOOD_WIDTH) throw new Error(`too small (${png.width}px wide)`);
  const baseFile = resolve(LOGO_DIR, `${channel.id}.png`);
  const onDisk = await inspect(baseFile);
  const before = previous.channels?.[channel.id];
  if (onDisk && quality(png.width, png.transparent) < quality(onDisk.width, before?.transparent)) {
    console.log(
      `[logos] ${channel.id}: keeping the ${onDisk.width}px logo on disk, ${png.width}px is worse`,
    );
    return false;
  }
  await writeFile(baseFile, png.buffer);
  const info = await inspect(baseFile);
  record.width = info?.width ?? png.width;
  record.height = info?.height ?? png.height;
  record.transparent = png.transparent;
  record.dark = info?.dark ?? false;
  record.origin = candidate.origin;
  record.sourceUrl = candidate.pageUrl ?? candidate.url;
  record.sourceFile = candidate.title;
  return true;
}

for (let start = 0; start < targets.length; start += BATCH_SIZE) {
  const batch = targets.slice(start, start + BATCH_SIZE);

  // Channels that already have a good logo are left alone.
  const pending = [];
  for (const channel of batch) {
    const baseFile = resolve(LOGO_DIR, `${channel.id}.png`);
    const onDisk = FORCE ? null : await inspect(baseFile);
    if (onDisk && onDisk.width >= GOOD_WIDTH) {
      const before = previous.channels?.[channel.id];
      records[channel.id] = {
        slug: channel.id,
        name: channel.name,
        family: channel.family,
        servers: channel.servers,
        base: `/logos/${channel.id}.png`,
        hd: before?.hd ?? null,
        hdSourceUrl: before?.hdSourceUrl ?? null,
        hdSourceFile: before?.hdSourceFile ?? null,
        hdWidth: before?.hdWidth ?? null,
        hdHeight: before?.hdHeight ?? null,
        hdTransparent: before?.hdTransparent ?? null,
        hdDark: before?.hdDark ?? null,
        sourceUrl: before?.sourceUrl ?? null,
        sourceFile: before?.sourceFile ?? null,
        origin: before?.origin ?? "previous",
        width: onDisk.width,
        height: onDisk.height,
        transparent: before?.transparent ?? false,
        dark: onDisk.dark,
        fallback: before?.fallback ?? false,
      };
      kept++;
      continue;
    }
    pending.push(channel);
  }
  if (!pending.length) continue;

  const candidates = await gather(pending);

  for (const channel of pending) {
    const record = {
      slug: channel.id,
      name: channel.name,
      family: channel.family,
      servers: channel.servers,
      base: `/logos/${channel.id}.png`,
      hd: null,
      sourceUrl: null,
      sourceFile: null,
      origin: null,
      width: 0,
      height: 0,
      transparent: false,
      fallback: false,
    };

    const list = candidates.get(channel.id) ?? [];
    const base = list
      .filter((c) => c.kind === "base" && usable(channel, c))
      .sort((a, b) => candidateRank(channel, b) - candidateRank(channel, a));

    if (VERBOSE) {
      console.log(`  ${channel.id}`);
      for (const candidate of list.filter((c) => c.kind === "base")) {
        const why = rejectReason(channel, candidate);
        console.log(
          `      · ${candidate.title.padEnd(52)} ${String(candidate.width).padStart(5)}x${String(candidate.height).padEnd(5)} ${why ? "no: " + why : "ok"}`,
        );
      }
    }

    const chosen = base[0];
    if (chosen) {
      if (DRY_RUN) {
        console.log(`[dry] ${channel.id.padEnd(22)} ${chosen.origin.padEnd(18)} ${chosen.title}`);
        record.origin = chosen.origin;
        record.sourceUrl = chosen.pageUrl ?? chosen.url;
        record.sourceFile = chosen.title;
        record.width = chosen.width;
        record.height = chosen.height;
      } else {
        // The best candidate can still fail to render — the next one is then
        // the one that counts.
        for (const candidate of base.slice(0, 3)) {
          try {
            if (await store(channel, candidate, record)) {
              fetched++;
              break;
            }
          } catch (err) {
            console.warn(`[logos] ${channel.id}: ${candidate.title} failed (${err.message})`);
          }
        }
      }
    }

    // The HD lockup — a separate, genuinely HD asset, not the base logo again.
    const hdList = list
      .filter((c) => c.kind === "hd" && hasHdMarker(c) && usable(channel, c))
      .filter((c) => c.title !== record.sourceFile)
      .sort((a, b) => candidateRank(channel, b) - candidateRank(channel, a));
    if (hdList.length) {
      if (DRY_RUN) {
        console.log(`[dry] ${channel.id.padEnd(22)} HD ${hdList[0].title}`);
      } else {
        for (const candidate of hdList.slice(0, 3)) {
          try {
            const png = await toPng(await download(candidate.url), candidate.mime, candidate.thumbUrl);
            if (png.width < GOOD_WIDTH) continue;
            await writeFile(resolve(LOGO_DIR, `${channel.id}-hd.png`), png.buffer);
            record.hd = `/logos/${channel.id}-hd.png`;
            record.hdSourceUrl = candidate.pageUrl ?? candidate.url;
            record.hdSourceFile = candidate.title;
            record.hdWidth = png.width;
            record.hdHeight = png.height;
            const hdInfo = await inspect(resolve(LOGO_DIR, `${channel.id}-hd.png`));
            record.hdTransparent = png.transparent;
            record.hdDark = hdInfo?.dark ?? false;
            hdCount++;
            break;
          } catch {
            /* try the next candidate */
          }
        }
      }
    }

    if (!record.sourceFile && !DRY_RUN) {
      // Nothing better exists: keep the upstream 40x20 file under the slug name
      // so every channel has a logo at a predictable path. A logo that is
      // already on disk is never replaced by the smaller one.
      const onDisk = await inspect(resolve(LOGO_DIR, `${channel.id}.png`));
      if (onDisk && onDisk.width >= GOOD_WIDTH) {
        const before = previous.channels?.[channel.id];
        record.width = onDisk.width;
        record.height = onDisk.height;
        record.transparent = before?.transparent ?? false;
        record.dark = onDisk.dark;
        record.origin = before?.origin ?? "previous";
        record.sourceUrl = before?.sourceUrl ?? null;
        record.sourceFile = before?.sourceFile ?? null;
        kept++;
      } else {
        const upstream = channel.fallbackFile
          ? resolve(ROOT, "public", channel.fallbackFile.replace(/^\//, ""))
          : null;
        try {
          if (!upstream) throw new Error("no upstream file");
          await access(upstream);
          await copyFile(upstream, resolve(LOGO_DIR, `${channel.id}.png`));
          record.fallback = true;
          record.origin = "upstream-40x20";
          record.sourceUrl = feedBySlug.get(channel.servers[0])?.icon ?? null;
          record.sourceFile = basename(channel.fallbackFile);
          record.width = 40;
          record.height = 20;
          record.transparent = false;
          record.dark = false;
          fallbacks++;
        } catch {
          failed++;
          // No logo at all: the record says so instead of pointing at a file
          // that does not exist.
          record.base = null;
          console.warn(`[logos] ${channel.id}: no logo and no upstream file`);
        }
      }
    }

    records[channel.id] = record;
  }

  const done = Math.min(start + BATCH_SIZE, targets.length);
  console.log(
    `[logos] ${done}/${targets.length} — ${fetched} fetched, ${kept} kept, ${hdCount} HD, ${fallbacks} on the 40x20 original`,
  );
}

if (!DRY_RUN) {
  // The index only knows the channels the taxonomy still has.
  const known = new Set(channels.map((c) => c.id));
  const merged = {};
  for (const [slug, record] of Object.entries(previous.channels ?? {})) {
    if (known.has(slug)) merged[slug] = record;
  }
  for (const [slug, record] of Object.entries(records)) merged[slug] = record;

  // `file` and `hdFile` are the file names under public/logos, the way
  // scripts/build-dataset.mjs reads them; `base` and `hd` are the paths the
  // app can hand to the browser.
  for (const record of Object.values(merged)) {
    record.file = record.base ? basename(record.base) : null;
    record.hdFile = record.hd ? basename(record.hd) : null;
  }

  const index = {
    generatedAt: new Date().toISOString(),
    naming: "public/logos/<slug>.png (base), public/logos/<slug>-hd.png (HD lockup)",
    upstream: UPSTREAM,
    wikimedia: `https://${COMMONS}/`,
    channels: Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))),
  };
  await mkdir(dirname(INDEX_FILE), { recursive: true });
  await writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf8");
}

const widths = Object.values(records)
  .map((r) => r.width)
  .filter((w) => w > 0)
  .sort((a, b) => a - b);
const median = widths.length ? widths[Math.floor(widths.length / 2)] : 0;
console.log(
  `[done] ${targets.length} channels — ${fetched} fetched, ${kept} kept, ${hdCount} HD lockups, ${fallbacks} left on the 40x20 original, ${failed} without a logo`,
);
if (widths.length) console.log(`[done] logo width — min ${widths[0]}, median ${median}, max ${widths.at(-1)}`);
if (!DRY_RUN) console.log(`[done] wrote data/logo-index.json`);
