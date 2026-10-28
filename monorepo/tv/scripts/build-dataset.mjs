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

/**
 * The third source directory. Its pages hide the playlist behind an
 * obfuscation that is undone at build time, so the addresses are stable and
 * can be stored like the first source's.
 */
const canaleTvData = await readJson("data/canale-tv-channels.json", { channels: [] });
const canaleTvStreams = await readJson("data/canale-tv-streams.json", { streams: {} });
const canaleTvBySlug = new Map(
  (canaleTvData.channels ?? []).map((c) => [c.slug, c]),
);

const qualityData = await readJson("data/quality.json", { feeds: {} });
const qualityByFeed = qualityData.feeds ?? {};

const logoData = await readJson("data/logo-index.json", { channels: {} });
const logoIndex = logoData.channels ?? {};

/**
 * The stills of the shows that are on.
 *
 * The file is written by the capture script and keyed by the catalogue id.
 * It is optional: a catalogue without stills is a catalogue without stills.
 */
const posterData = await readJson("data/posters.json", { posters: {} });
const posterIndex = posterData.posters ?? {};

/**
 * How many stills of one channel the catalogue carries.
 *
 * The card only ever shows the still of the programme on air and the one
 * before it; the rest is weight in every page that lists the channel.
 */
const STILL_LIMIT = 4;

/**
 * The stills of a channel, newest first.
 *
 * Each still says which programme it shows, so the card can pick the
 * picture that belongs to the slot on air. The manifest used to hold one
 * still per channel; that shape is read as a list of one.
 */
const stillsOf = (id) => {
  const entry = posterIndex[id];
  if (!entry) return [];
  const list = Array.isArray(entry) ? entry : [entry];
  return list
    .filter((still) => still?.file)
    .map((still) => ({
      file: `/posters/${still.file}`,
      capturedAt: still.capturedAt ?? null,
      programme: still.programme ?? null,
    }))
    .sort(
      (a, b) => (b.programme?.startsAt ?? 0) - (a.programme?.startsAt ?? 0),
    )
    .slice(0, STILL_LIMIT);
};

/** The still of a channel, when one has been captured. */
const posterOf = (id) => stillsOf(id)[0]?.file ?? null;

/**
 * The liveness probe, by feed.
 *
 * The probe walks the real playback path, so its answer is the truth: a feed
 * that answers with a manifest is live, one the upstream refuses is blocked,
 * one that does not answer is an error.
 */
const healthByKey = new Map(
  (health.feeds ?? []).map((record) => [record.key, record]),
);

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
 *
 * The slugs are used rather than the feed ids: a feed of the first source
 * may carry an id of its own when the second source lists the same channel
 * under the same slug.
 */
const logoKeys = (channel, slugs) => [
  channel.id,
  slugify(channel.name),
  ...slugs,
  ...slugs.map((slug) => slugify(slug)),
];

const highResLogo = (channel, slugs) => {
  for (const key of logoKeys(channel, slugs)) {
    const entry = logoIndex[key];
    if (entry?.file) return `/logos/${entry.file}`;
  }
  return null;
};

const highResLogoHd = (channel, slugs) => {
  for (const key of logoKeys(channel, slugs)) {
    const entry = logoIndex[key];
    if (entry?.hdFile) return `/logos/${entry.hdFile}`;
  }
  return null;
};

/**
 * Dark artwork needs a light plate behind it to stay legible on a dark card.
 */
const logoIsDark = (channel, slugs) => {
  for (const key of logoKeys(channel, slugs)) {
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

/**
 * The status of one feed, as measured by the liveness probe.
 *
 * A feed the probe never saw is "unknown" — not live. The catalogue may
 * only claim a channel is live when the probe watched it play.
 */
const statusOf = (key, feed) => {
  const record = healthByKey.get(key);
  if (record) {
    if (record.state === "live") return "live";
    if (record.state === "blocked") return "blocked";
    if (record.state === "error") return "error";
    if (record.state === "acestream") return "acestream";
    return "unknown";
  }
  if (feed?.embedUrl) return "unknown";
  if (feed?.acestreamId) return "acestream";
  if (feed?.directStreams?.length) return "live";
  return "none";
};

/**
 * The playlist a feed plays, when the probe saw one.
 *
 * The address is measured, not remembered: it is what the upstream answered
 * with at the time of the probe. A feed whose playlist did not answer keeps
 * the one the resolver found earlier, if there is one — the upstream may
 * have been down for a moment.
 */
const playlistOf = (key, feed) => {
  const record = healthByKey.get(key);
  if (record?.state === "live" && record.streamUrl) return record.streamUrl;
  return streams[feed?.slug]?.hlsUrl ?? null;
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
/** The scraped feed behind every server, so the logo is looked up by slug. */
const feedOfServer = new Map();
/** The slug of every server: the feed's own name in the source. */
const slugOfServer = new Map();

for (const [familyKey, family] of Object.entries(taxonomy.families)) {
  for (const channel of family.channels) {
    const servers = [];
    for (const server of channel.servers) {
      // The third source's pages hide the playlist behind an obfuscation; it
      // is undone at build time and the address is stable, so it is stored.
      if (server.source === "canale-tv") {
        const feed = canaleTvBySlug.get(server.slug);
        const resolved = canaleTvStreams.streams?.[server.slug];
        if (!feed || !resolved) {
          problems.push(
            `third-source slug "${server.slug}" has no resolved playlist (${familyKey})`,
          );
          continue;
        }
        const key = `canale-tv:${server.slug}`;
        const entry = {
          id: server.id ?? `canale-tv:${server.slug}`,
          label: server.label,
          embedUrl: null,
          sourcePage: feed.page,
          status: statusOf(key, { embedUrl: resolved.hlsUrl }),
          kind: "iframe",
          hlsUrl: resolved.hlsUrl,
          quality: qualityOf(server.slug),
          source: "canale-tv",
        };
        servers.push(entry);
        feedOfServer.set(entry, { icon: null, logo: null });
        slugOfServer.set(entry, server.slug);
        continue;
      }

      // A feed may come from the second source rather than the first scrape.
      if (server.source === "secondary") {        const feed = secondaryBySlug.get(server.slug);
        if (!feed) {
          problems.push(
            `secondary slug "${server.slug}" is not in data/secondary-sources.json (${familyKey})`,
          );
          continue;
        }
        // The second source's playlist address carries a token that expires in
        // minutes, so it is never stored: the server asks for a fresh one
        // when the feed is played.
        const key = `secondary:${server.slug}`;
        const entry = {
          // The second source knows its channel by this slug, and the server
          // asks it for a fresh address under this id — so it stays the slug.
          id: server.slug,
          label: server.label,
          embedUrl: feed.kind === "hls" ? null : (feed.stream ?? null),
          sourcePage: feed.sourcePage ?? feed.playerPage ?? null,
          status: statusOf(key, feed),
          kind: "iframe",
          hlsUrl: null,
          quality: feed.hd ? "hd" : "sd",
          source: "secondary",
        };
        servers.push(entry);
        feedOfServer.set(entry, feed);
        slugOfServer.set(entry, server.slug);
        continue;
      }

      const feed = feedBySlug.get(server.slug);
      if (!feed) {
        problems.push(`taxonomy slug "${server.slug}" is not in the scrape (${familyKey})`);
        continue;
      }
      const key = `primary:${server.slug}`;
      const entry = {
        // The first source's feed may need an id of its own: the second
        // source uses the same slug for the same channel, and a channel
        // cannot carry two feeds under one id.
        id: server.id ?? server.slug,
        label: server.label,
        embedUrl: feed.embedUrl ?? null,
        sourcePage: feed.sourcePage,
        status: statusOf(key, feed),
        kind: kindOf(feed),
        hlsUrl: playlistOf(key, feed),
        quality: qualityOf(server.slug),
        source: "primary",
      };
      servers.push(entry);
      feedOfServer.set(entry, feed);
      slugOfServer.set(entry, server.slug);
    }

    if (!servers.length) {
      problems.push(`channel "${channel.name}" has no server in the scrape (${familyKey})`);
      continue;
    }

    // The logo comes from the first feed the source lists for the channel,
    // unless the high-resolution library has a better one.
    const firstFeed = feedOfServer.get(servers[0]) ?? null;
    const logoRemote = firstFeed?.icon ?? firstFeed?.logo ?? null;
    const slugs = servers.map((server) => slugOfServer.get(server) ?? server.id);
    const logo = highResLogo(channel, slugs) ?? localLogo(logoRemote);
    const logoHd = highResLogoHd(channel, slugs);
    const logoDark = logoIsDark(channel, slugs);

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
      // How many people watch a channel is a live number: it is read from
      // the source when the page is rendered, never frozen into the build.
      views: null,
      poster: posterOf(id),
      stills: stillsOf(id),
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

/**
 * The counts the release notes are written from: what plays, what does not,
 * and how much of it is in high definition.
 */
const liveChannels = channels.filter((ch) => ch.status === "live");
const deadChannels = channels.filter((ch) => ch.status !== "live");
const hdChannels = channels.filter((ch) =>
  ["hd", "fhd", "uhd"].includes(ch.quality),
);
console.log(
  `[dataset] live ${liveChannels.length}, not live ${deadChannels.length}, HD ${hdChannels.length}`,
);
if (deadChannels.length) {
  console.log("[dataset] channels with no live feed:");
  for (const ch of deadChannels) {
    console.log(
      `   ${ch.name.padEnd(24)} ${ch.status.padEnd(8)} ${ch.servers.map((s) => `${s.id}:${s.status}`).join(", ")}`,
    );
  }
}

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
