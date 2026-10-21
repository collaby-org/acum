/**
 * Dataset builder.
 *
 * Merges the upstream artifacts into the typed module the app imports:
 *
 *   data/channels.raw.json      the scrape (slugs, source pages, embed URLs)
 *   data/embed-health.json      the liveness probe (does the embed play?)
 *   data/resolved-streams.json  the direct HLS playlist behind a player page
 *   scripts/channel-taxonomy.json  the hand-written names + categories
 *
 * A channel is one real broadcast channel; every upstream feed of it is a
 * *server* of that channel, ordered best first so the player can fall back.
 *
 * It also mirrors the channel logos into public/logos/ so the UI never hotlinks
 * the source site.
 *
 *   node scripts/build-dataset.mjs
 */
import { writeFile, mkdir, readFile, access } from "node:fs/promises";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LOGO_DIR = resolve(ROOT, "public/logos");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const raw = JSON.parse(await readFile(resolve(ROOT, "data/channels.raw.json"), "utf8"));
const health = JSON.parse(await readFile(resolve(ROOT, "data/embed-health.json"), "utf8"));
const taxonomy = JSON.parse(
  await readFile(resolve(__dirname, "channel-taxonomy.json"), "utf8"),
);
const streams = await readFile(resolve(ROOT, "data/resolved-streams.json"), "utf8").then(
  (text) => JSON.parse(text),
  () => ({}),
);

const healthByUrl = new Map(health.map((h) => [h.url, h]));

/* ------------------------------------------------------------------ *
 * Logos
 * ------------------------------------------------------------------ */
await mkdir(LOGO_DIR, { recursive: true });

const logoSources = new Map(); // remote url -> local file name
for (const c of raw.channels) {
  if (!c.icon) continue;
  const file = basename(new URL(c.icon).pathname);
  if (!logoSources.has(c.icon)) logoSources.set(c.icon, file);
}

let downloaded = 0;
let cached = 0;
let failed = 0;
await Promise.all(
  [...logoSources.entries()].map(async ([remote, file]) => {
    const target = resolve(LOGO_DIR, file);
    try {
      await access(target);
      cached++;
      return;
    } catch {
      /* not on disk yet */
    }
    try {
      const res = await fetch(remote, {
        headers: { "user-agent": UA, referer: "https://www.cool-etv.net/" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) throw new Error("suspiciously small");
      await writeFile(target, buf);
      downloaded++;
    } catch {
      failed++;
    }
  }),
);
console.log(`[logos] ${downloaded} downloaded, ${cached} cached, ${failed} failed`);

const localLogo = (remote) => {
  if (!remote) return null;
  const file = logoSources.get(remote);
  return file ? `/logos/${file}` : null;
};

/* ------------------------------------------------------------------ *
 * Feeds
 * ------------------------------------------------------------------ */
/** The scrape lists a few feeds twice (the source reuses one slug). */
const feedBySlug = new Map();
for (const feed of raw.channels) {
  if (!feedBySlug.has(feed.slug)) feedBySlug.set(feed.slug, feed);
}

const statusOf = (feed) => {
  if (feed.embedUrl) {
    const h = healthByUrl.get(feed.embedUrl);
    if (!h) return "unknown";
    if (h.state === "player") return "live";
    if (h.state === "blocked" || h.state === "parked") return "blocked";
    if (h.state === "error") return "error";
    return "unknown";
  }
  if (feed.acestreamId) return "acestream";
  if (feed.directStreams?.length) return "live";
  return "none";
};

const kindOf = (feed) => {
  if (feed.embedUrl) return "iframe";
  if (feed.acestreamId) return "acestream";
  return "none";
};

/* ------------------------------------------------------------------ *
 * Channels
 * ------------------------------------------------------------------ */
/** URL-safe id: diacritics folded, everything else alphanumeric. */
const slugify = (name) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șț]/g, (c) => (c === "ș" ? "s" : "t"))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** The best status of a channel: live wins over everything else. */
const STATUS_RANK = { live: 6, blocked: 5, error: 4, unknown: 3, acestream: 2, none: 1 };

const usedIds = new Set();
const channels = [];
const problems = [];

for (const [familyKey, family] of Object.entries(taxonomy.families)) {
  for (const channel of family.channels) {
    const servers = [];
    for (const server of channel.servers) {
      const feed = feedBySlug.get(server.slug);
      if (!feed) {
        problems.push(`taxonomy slug "${server.slug}" is not in the scrape (${familyKey})`);
        continue;
      }
      const resolved = streams[server.slug] ?? null;
      servers.push({
        id: server.slug,
        label: server.label,
        embedUrl: feed.embedUrl ?? null,
        sourcePage: feed.sourcePage,
        // A resolved playlist is a live feed, even when the embed page the
        // source ships for it is dead — the playlist came from the same
        // upstream, through another panel.
        status: resolved?.hlsUrl ? "live" : statusOf(feed),
        kind: kindOf(feed),
        hlsUrl: resolved?.hlsUrl ?? null,
      });
    }

    if (!servers.length) {
      problems.push(`channel "${channel.name}" has no server in the scrape (${familyKey})`);
      continue;
    }

    // The logo comes from the first feed the source lists for the channel.
    const logo = localLogo(feedBySlug.get(servers[0].id)?.icon ?? null);
    const logoRemote = feedBySlug.get(servers[0].id)?.icon ?? null;

    // Best first: a resolved playlist, then a live embed, then the rest.
    servers.sort((a, b) => {
      if (a.hlsUrl !== b.hlsUrl) return a.hlsUrl ? -1 : 1;
      const rank = STATUS_RANK[b.status] - STATUS_RANK[a.status];
      if (rank) return rank;
      return a.id.localeCompare(b.id);
    });

    let id = slugify(channel.name);
    if (!id) id = slugify(familyKey) || "channel";
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
      familyKey,
      category: family.category,
      logo,
      logoRemote,
      status: servers.reduce(
        (best, s) => (STATUS_RANK[s.status] > STATUS_RANK[best] ? s.status : best),
        "none",
      ),
      servers,
    });
  }
}

const taxonomySlugs = new Set();
for (const family of Object.values(taxonomy.families)) {
  for (const channel of family.channels) {
    for (const server of channel.servers) taxonomySlugs.add(server.slug);
  }
}
for (const slug of feedBySlug.keys()) {
  if (!taxonomySlugs.has(slug)) problems.push(`scraped feed "${slug}" is missing from the taxonomy`);
}

if (problems.length) {
  console.warn(`[warn] ${problems.length} taxonomy/scrape mismatch(es):`);
  for (const p of problems) console.warn(`   - ${p}`);
} else {
  console.log("[dataset] taxonomy and scrape agree on every feed");
}

/* ------------------------------------------------------------------ *
 * Emit src/data/channels.ts
 * ------------------------------------------------------------------ */
const categoryCounts = {};
for (const ch of channels) {
  categoryCounts[ch.category] = (categoryCounts[ch.category] || 0) + 1;
}
console.log("[dataset] channels", channels.length, "categories", categoryCounts);
const statusCounts = {};
for (const ch of channels) statusCounts[ch.status] = (statusCounts[ch.status] || 0) + 1;
console.log("[dataset] status", statusCounts);
const serverCount = channels.reduce((n, ch) => n + ch.servers.length, 0);
const withHls = channels.filter((ch) => ch.servers.some((s) => s.hlsUrl)).length;
console.log(
  `[dataset] servers ${serverCount}, channels with a direct playlist ${withHls}, channels with more than one server ${channels.filter((ch) => ch.servers.length > 1).length}`,
);

const ts = `// AUTO-GENERATED by scripts/build-dataset.mjs — do not edit by hand.
//
// Source: https://www.cool-etv.net/ (scraped ${raw.generatedAt})
// ${channels.length} channels · ${serverCount} upstream servers · ${taxonomy.categories.length} categories

import type { Category, Channel } from "./types";

export type {
  Category,
  CategoryId,
  Channel,
  Server,
  ServerKind,
  ServerStatus,
} from "./types";

export const CATEGORIES: Category[] = ${JSON.stringify(taxonomy.categories, null, 2)};

export const CHANNELS: Channel[] = ${JSON.stringify(channels, null, 2)};

export const CHANNEL_COUNT = CHANNELS.length;
`;

const target = resolve(ROOT, "src/data/channels.ts");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, ts, "utf8");
console.log(`[dataset] wrote src/data/channels.ts (${channels.length} channels)`);
