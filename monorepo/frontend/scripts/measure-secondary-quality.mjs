/**
 * Measure the picture height of the second source's feeds.
 *
 * The second source hands out a fresh stream address per request, and that
 * address carries a token which lives about three minutes. So the list is
 * fetched again before every batch: the feeds are measured in small groups,
 * each with addresses that were issued seconds earlier, and the addresses are
 * thrown away afterwards — the measurement is what is kept.
 *
 *   node scripts/measure-secondary-quality.mjs
 *
 * Writes data/quality-secondary.json and folds the result into
 * data/quality.json.
 */
import { readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const STREAMS = resolve(ROOT, "data/resolved-streams.json");
const SECONDARY = resolve(ROOT, "data/secondary-sources.json");
const QUALITY = resolve(ROOT, "data/quality.json");
const OUT = resolve(ROOT, "data/quality-secondary.json");

/** How many feeds one set of addresses is good for. */
const BATCH = 12;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const REFERER = "https://canaletvlive.online/";

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const secondary = await readJson(SECONDARY, { channels: [] });
const hlsSlugs = secondary.channels
  .filter((entry) => entry.kind === "hls")
  .map((entry) => entry.slug);

if (hlsSlugs.length === 0) {
  console.log("[secondary] nothing to measure");
  process.exit(0);
}

/** A fresh address for every feed the second source offers. */
async function freshAddresses() {
  const res = await fetch("https://canaletvlive.online/api/channels", {
    headers: { "user-agent": UA, referer: REFERER },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`the channel list answered ${res.status}`);
  const list = await res.json();
  const bySlug = new Map();
  for (const entry of list) {
    if (entry?.slug && entry.stream_url) bySlug.set(entry.slug, entry.stream_url);
  }
  return bySlug;
}

const backup = await readFile(STREAMS, "utf8");
const primary = JSON.parse(backup);
const measured = {};

for (let start = 0; start < hlsSlugs.length; start += BATCH) {
  const batch = hlsSlugs.slice(start, start + BATCH);
  const addresses = await freshAddresses();

  const wanted = {};
  for (const slug of batch) {
    const url = addresses.get(slug);
    if (url) {
      wanted[slug] = {
        hlsUrl: url,
        playerPage: `https://canaletvlive.online/watch/${slug}`,
        embedUrl: `https://canaletvlive.online/watch/${slug}`,
      };
    }
  }

  // The measurement script reads the resolved-stream file, so the fresh
  // addresses are written there for the duration of the batch and taken out
  // again afterwards.
  await writeFile(
    STREAMS,
    JSON.stringify({ ...primary, ...wanted }, null, 2),
    "utf8",
  );

  const child = spawn(
    process.execPath,
    [
      resolve(__dirname, "measure-quality.mjs"),
      "--out",
      OUT,
      ...Object.keys(wanted),
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  const code = await new Promise((res) => child.on("close", res));
  await writeFile(STREAMS, backup, "utf8");

  if (code !== 0) {
    console.error("[secondary] the measurement failed; the stream file was restored");
    process.exit(code ?? 1);
  }

  const batchResult = await readJson(OUT, { feeds: {} });
  Object.assign(measured, batchResult.feeds ?? {});
  console.log(
    `[secondary] ${Math.min(start + BATCH, hlsSlugs.length)}/${hlsSlugs.length} measured`,
  );
}

// Fold the result into the main quality file.
const quality = await readJson(QUALITY, { feeds: {} });
quality.feeds = { ...quality.feeds, ...measured };
quality.generatedAt = new Date().toISOString();
await writeFile(QUALITY, JSON.stringify(quality, null, 2), "utf8");
await rm(OUT, { force: true });

const counts = {};
for (const feed of Object.values(measured)) {
  counts[feed.quality] = (counts[feed.quality] || 0) + 1;
}
console.log("[secondary] measured:", JSON.stringify(counts));
