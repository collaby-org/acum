/**
 * Merge the third source's channels into the taxonomy.
 *
 * The taxonomy is the hand-written editorial layer: a channel, its category,
 * and the upstream feeds that carry it. This script folds the third
 * directory's catalogue into it:
 *
 *   - a channel we already have gains a third feed, which is exactly the
 *     fallback the player needs;
 *   - a channel we do not have is created, in its own family.
 *
 * The names the third source uses are mangled ASCII — "HB0" for "HBO",
 * "SH0WTIME 1" for "Show 1" — so they are matched with a fold, and the
 * few that differ for another reason are listed by hand in
 * `data/canale-tv-aliases.json`.
 *
 * It is idempotent: running it twice changes nothing.
 *
 *   node scripts/merge-canale-tv.mjs [--dry-run]
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TAXONOMY = resolve(__dirname, "channel-taxonomy.json");
const SOURCE = resolve(ROOT, "data/canale-tv-channels.json");
const ALIASES = resolve(ROOT, "data/canale-tv-aliases.json");

const dryRun = process.argv.includes("--dry-run");

/**
 * The noise the third source writes its names with, folded away: "HB0" is
 * "HBO", "SH0WTIME" is "SHOWTIME", "TVR1" is "TVR 1".
 */
const fold = (value) =>
  value
    .toUpperCase()
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/5/g, "S")
    .replace(/8/g, "B")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

const tight = (value) => fold(value).replace(/ /g, "");

const source = JSON.parse(await readFile(SOURCE, "utf8"));
const alias = JSON.parse(await readFile(ALIASES, "utf8"));
const taxonomy = JSON.parse(await readFile(TAXONOMY, "utf8"));

/** Every channel we already have, by folded name. */
const byFold = new Map();
const byTight = new Map();
for (const family of Object.values(taxonomy.families)) {
  for (const channel of family.channels) {
    byFold.set(fold(channel.name), channel);
    if (!byTight.has(tight(channel.name))) byTight.set(tight(channel.name), channel);
  }
}

/** The category a new channel belongs to, when the source does not say. */
const CATEGORY = {
  "BBC NEWS": "stiri",
  "PRIMA SPORT 4": "sport",
  "PRIMA SPORT 5": "sport",
  "PPV 1": "sport",
  "PPV 2": "sport",
  "PPV 3": "sport",
  "SPORT EXTRA": "sport",
  "WARNER TV": "movies",
  "BBC FIRST": "kids",
  "NAT GEO PEOPLE": "documentare",
  "TRAVEL MIX": "documentare",
  HGTV: "documentare",
  "Canal 33": "generaliste",
};

const FAMILY = "Alte canale (sursa 3)";

const addedFeeds = [];
const addedChannels = [];
const skipped = [];

for (const entry of source.channels) {
  const manual = alias.manual?.[entry.name];
  const match =
    (manual ? byFold.get(fold(manual)) ?? byTight.get(tight(manual)) : null) ??
    byFold.get(fold(entry.name)) ??
    byTight.get(tight(entry.name));

  if (match) {
    if (match.servers.some((server) => server.slug === entry.slug)) {
      skipped.push(entry.name);
      continue;
    }
    // The feed needs an id of its own: the same channel can carry feeds from
    // three sources, and their slugs are not guaranteed to differ.
    match.servers.push({
      slug: entry.slug,
      id: `canale-tv:${entry.slug}`,
      label: "S3",
      source: "canale-tv",
    });
    addedFeeds.push(`${match.name} ← ${entry.name}`);
    continue;
  }

  const category = CATEGORY[entry.name] ?? "generaliste";
  taxonomy.families[FAMILY] ??= {
    name: "Alte canale",
    category,
    channels: [],
  };
  taxonomy.families[FAMILY].channels.push({
    name: entry.name,
    servers: [
      {
        slug: entry.slug,
        id: `canale-tv:${entry.slug}`,
        label: "S1",
        source: "canale-tv",
      },
    ],
  });
  addedChannels.push(`${entry.name} (${category})`);
}

const summary = `+${addedChannels.length} channels, +${addedFeeds.length} third feeds`;

if (dryRun) {
  console.log(`[dry] ${summary}`);
  for (const line of addedChannels) console.log("  +", line);
  for (const line of addedFeeds) console.log("  ~", line);
} else {
  await writeFile(TAXONOMY, `${JSON.stringify(taxonomy, null, 2)}\n`, "utf8");
  console.log(
    `[merge] ${summary}, ${Object.keys(taxonomy.families).length} families, ${skipped.length} already present`,
  );
  for (const line of addedChannels) console.log("  +", line);
  for (const line of addedFeeds) console.log("  ~", line);
}
