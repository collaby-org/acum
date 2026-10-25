/**
 * Merge the second source's channels into the taxonomy.
 *
 * The taxonomy is the hand-written editorial layer: a channel, its category,
 * and the upstream feeds that carry it. This script folds the second
 * directory's catalogue into it:
 *
 *   - a channel we already have gains a second feed, which is exactly the
 *     fallback the player needs;
 *   - a channel we do not have is created, in its own family.
 *
 * It is idempotent: running it twice changes nothing.
 *
 *   node scripts/merge-secondary.mjs [--dry-run]
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TAXONOMY = resolve(__dirname, "channel-taxonomy.json");
const SECONDARY = resolve(ROOT, "data/secondary-sources.json");

const dryRun = process.argv.includes("--dry-run");

/**
 * The second source names a channel differently in a few dozen cases. The
 * key is the source's name, folded to lower case with the punctuation
 * removed; the value is the name we already use.
 */
const ALIASES = {
  b1tv: "B1 TV",
  cinemax: "Cinemax 1",
  "crime investigation": "Crime+",
  discovery: "Discovery Channel",
  diva: "Diva Universal",
  epicdrama: "Epic Drama",
  etnotv: "Etno TV",
  "filmbox premium": "Filmbox HD",
  "fishing and hunting": "Fishing & Hunting",
  "hit music channel": "Hit Music",
  id: "Discovery ID",
  "kanal d2": "Kanal D 2",
  minimax: "MiniMax",
  "national tv": "Național TV",
  "nick jr": "Nickelodeon Junior",
  nicktoons: "NickToons",
  "pro cinema": "PRO CINEMA",
  protv: "PRO TV",
  "realitatea plus": "Realitatea",
  "tv favorit": "Favorit TV",
  "tv paprika": "Paprika TV",
  "zu tv": "Zu TV",
};

/** The second source's categories, and ours. */
const CATEGORY_MAP = {
  divertisment: "generaliste",
  generale: "generaliste",
  religioase: "generaliste",
  "filme & seriale": "movies",
  stiri: "stiri",
  muzica: "music",
  documentare: "documentare",
  copii: "kids",
  sport: "sport",
};

/** Channels whose category the source's own label would get wrong. */
const CATEGORY_OVERRIDE = {
  "Antena 3 CNN": "stiri",
  "BBC World News": "stiri",
  "Digi 24": "stiri",
  "Digi Sport 1": "sport",
  "Digi Sport 2": "sport",
  "Digi Sport 3": "sport",
  "Digi Sport 4": "sport",
  "EuroSport 1": "sport",
  "EuroSport 2": "sport",
  "Prima Sport 1": "sport",
  "Prima Sport 2": "sport",
  "Prima Sport 3": "sport",
  "Pro Arena": "sport",
  "Balcan Music": "music",
  MTV: "music",
  Tralala: "music",
  Dizi: "movies",
  "Film Now": "movies",
  Cinemaraton: "movies",
  CineWOW: "movies",
  Cartoonito: "kids",
  "Magic TV": "generaliste",
  "Traditional TV": "generaliste",
};

const normalise = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .replace(/[ăâ]/g, "a")
    .replace(/[î]/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const taxonomy = JSON.parse(await readFile(TAXONOMY, "utf8"));
const secondary = JSON.parse(await readFile(SECONDARY, "utf8"));

/** Every channel we already have, by folded name. */
const ours = new Map();
for (const [familyKey, family] of Object.entries(taxonomy.families)) {
  for (const channel of family.channels) {
    ours.set(normalise(channel.name), { channel, familyKey, family });
  }
}

const addedFeeds = [];
const addedChannels = [];

for (const entry of secondary.channels) {
  const alias = ALIASES[normalise(entry.name)];
  const match = ours.get(normalise(alias ?? entry.name));

  if (match) {
    if (match.channel.servers.some((s) => s.slug === entry.slug)) continue;
    match.channel.servers.push({
      slug: entry.slug,
      label: "S2",
      source: "secondary",
    });
    addedFeeds.push(`${match.channel.name} ← ${entry.name}`);
    continue;
  }

  // A channel we do not have yet.
  const category =
    CATEGORY_OVERRIDE[entry.name] ??
    CATEGORY_MAP[normalise(entry.category ?? "")] ??
    "generaliste";
  const familyKey = "Alte canale";
  taxonomy.families[familyKey] ??= {
    name: "Alte canale",
    category,
    channels: [],
  };
  taxonomy.families[familyKey].channels.push({
    name: entry.name,
    servers: [{ slug: entry.slug, label: "S1", source: "secondary" }],
  });
  addedChannels.push(`${entry.name} (${category})`);
}

const summary = `+${addedChannels.length} channels, +${addedFeeds.length} second feeds`;

if (dryRun) {
  console.log(`[dry] ${summary}`);
  for (const line of addedChannels) console.log("  +", line);
  for (const line of addedFeeds) console.log("  ~", line);
} else {
  await writeFile(TAXONOMY, `${JSON.stringify(taxonomy, null, 2)}\n`, "utf8");
  console.log(
    `[merge] ${summary}, ${Object.keys(taxonomy.families).length} families`,
  );
  for (const line of addedChannels) console.log("  +", line);
  for (const line of addedFeeds) console.log("  ~", line);
}
