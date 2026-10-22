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

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(resolve(ROOT, file), "utf8"));
  } catch {
    return fallback;
  }
};

/**
 * The second source directory. Its feeds are not in the cool-etv.net scrape,
 * so they arrive with their own stream URL and watch page.
 */
const secondaryData = await readJson("data/secondary-sources.json", { channels: [] });
const secondaryBySlug = new Map(
  (secondaryData.channels ?? []).map((c) => [c.slug, c]),
);

const qualityData = await readJson("data/quality.json", { feeds: {} });
const qualityByFeed = qualityData.feeds ?? {};

const logoData = await readJson("data/logo-index.json", { channels: {} });
const logoIndex = logoData.channels ?? {};

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
// The second source publishes its own logos; mirror them too.
for (const c of secondaryData.channels ?? []) {
  if (!c.logo) continue;
  try {
    const file = basename(new URL(c.logo).pathname);
    if (!logoSources.has(c.logo)) logoSources.set(c.logo, file);
  } catch {
    /* not a usable URL */
  }
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
 * Measured quality and the high-resolution logo library
 * ------------------------------------------------------------------ */

/** The quality of a feed, as measured. */
const qualityOf = (slug) => qualityByFeed[slug]?.quality ?? "unknown";

/**
 * The high-resolution logo for a channel, if the library has one.
 *
 * The index may be keyed by the channel id, the display name, or any of the
 * channel's feed slugs, so try each of them before giving up.
 */
const highResLogo = (channel, servers) => {
  const keys = [
    channel.id,
    slugify(channel.name),
    ...servers.map((s) => s.id),
    ...servers.map((s) => slugify(s.id)),
  ];
  for (const key of keys) {
    const entry = logoIndex[key];
    if (entry?.file) return `/logos/${entry.file}`;
  }
  return null;
};

const highResLogoHd = (channel, servers) => {
  const keys = [
    channel.id,
    slugify(channel.name),
    ...servers.map((s) => s.id),
    ...servers.map((s) => slugify(s.id)),
  ];
  for (const key of keys) {
    const entry = logoIndex[key];
    if (entry?.hdFile) return `/logos/${entry.hdFile}`;
  }
  return null;
};

/**
 * Dark artwork needs a light plate behind it to stay legible on a dark card.
 */
const logoIsDark = (channel, servers) => {
  const keys = [
    channel.id,
    slugify(channel.name),
    ...servers.map((s) => s.id),
    ...servers.map((s) => slugify(s.id)),
  ];
  for (const key of keys) {
    const entry = logoIndex[key];
    if (entry) return Boolean(entry.dark);
  }
  return false;
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

/** The best quality wins: HD before SD. */
const QUALITY_RANK = { uhd: 6, fhd: 5, hd: 4, sd: 3, low: 2, unknown: 1 };

const usedIds = new Set();
const channels = [];
const problems = [];

for (const [familyKey, family] of Object.entries(taxonomy.families)) {
  for (const channel of family.channels) {
    const servers = [];
    for (const server of channel.servers) {
      // A feed may come from the second source rather than the first scrape.
      if (server.source === "secondary") {
        const feed = secondaryBySlug.get(server.slug);
        if (!feed) {
          problems.push(
            `secondary slug "${server.slug}" is not in data/secondary-sources.json (${familyKey})`,
          );
          continue;
        }
        // The second source's playlist address carries a token that expires in
        // minutes, so it is never stored: the server asks for a fresh one
        // when the feed is played.
        const direct = feed.kind === "hls";
        servers.push({
          id: server.slug,
          label: server.label,
          embedUrl: direct ? null : (feed.stream ?? null),
          sourcePage: feed.sourcePage ?? feed.playerPage ?? null,
          status: direct ? "live" : "unknown",
          kind: "iframe",
          hlsUrl: null,
          quality: direct ? (feed.hd ? "hd" : "sd") : "unknown",
          source: "secondary",
        });
        continue;
      }

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
        quality: qualityOf(server.slug),
        source: "primary",
      });
    }

    if (!servers.length) {
      problems.push(`channel "${channel.name}" has no server in the scrape (${familyKey})`);
      continue;
    }

    // The logo comes from the first feed the source lists for the channel,
    // unless the high-resolution library has a better one.
    const firstFeed = feedBySlug.get(servers[0].id);
    const firstSecondary = secondaryBySlug.get(servers[0].id);
    const logoRemote = firstFeed?.icon ?? firstSecondary?.logo ?? null;
    const logo = highResLogo(channel, servers) ?? localLogo(logoRemote);
    const logoHd = highResLogoHd(channel, servers);
    const logoDark = logoIsDark(channel, servers);

    // Best first: a resolved playlist, then the highest quality, then a live
    // embed, then the rest. The player walks this list, so the order is the
    // failover order.
    servers.sort((a, b) => {
      if (a.hlsUrl !== b.hlsUrl) return a.hlsUrl ? -1 : 1;
      const quality = QUALITY_RANK[b.quality] - QUALITY_RANK[a.quality];
      if (quality) return quality;
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
      logoHd,
      logoDark,
      logoRemote,
      status: servers.reduce(
        (best, s) => (STATUS_RANK[s.status] > STATUS_RANK[best] ? s.status : best),
        "none",
      ),
      quality: servers.reduce(
        (best, s) => (QUALITY_RANK[s.quality] > QUALITY_RANK[best] ? s.quality : best),
        "unknown",
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

import type { Category, UpstreamChannel } from "./types";

export type {
  Category,
  CategoryId,
  Channel,
  Quality,
  Server,
  ServerKind,
  ServerStatus,
  UpstreamChannel,
  UpstreamServer,
} from "./types";

export const CATEGORIES: Category[] = ${JSON.stringify(taxonomy.categories, null, 2)};

export const CHANNELS: UpstreamChannel[] = ${JSON.stringify(channels, null, 2)};

export const CHANNEL_COUNT = CHANNELS.length;
`;

const target = resolve(ROOT, "src/data/channels.ts");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, ts, "utf8");
console.log(`[dataset] wrote src/data/channels.ts (${channels.length} channels)`);
