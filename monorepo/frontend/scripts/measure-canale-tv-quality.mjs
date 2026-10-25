/**
 * Measure the picture height of the third source's feeds.
 *
 * The measurement is the same one the first source's feeds get: the real
 * height is read out of the sequence parameter set of an actual segment,
 * because the advertised codec string is the same on every playlist and
 * lies about the height.
 *
 *   node scripts/measure-canale-tv-quality.mjs
 *
 * Folds the result into data/quality.json.
 */
import { readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const STREAMS = resolve(ROOT, "data/resolved-streams.json");
const SOURCE = resolve(ROOT, "data/canale-tv-streams.json");
const QUALITY = resolve(ROOT, "data/quality.json");
const OUT = resolve(ROOT, "data/quality-canale-tv.json");

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const source = await readJson(SOURCE, { streams: {} });
const slugs = Object.keys(source.streams ?? {});
if (slugs.length === 0) {
  console.log("[canale-tv] nothing to measure");
  process.exit(0);
}

// The measurement script reads the resolved-stream file, so the addresses
// are written there for the duration of the run and taken out again after.
const backup = await readFile(STREAMS, "utf8");
const primary = JSON.parse(backup);
const wanted = {};
for (const slug of slugs) {
  wanted[slug] = {
    hlsUrl: source.streams[slug].hlsUrl,
    playerPage: source.streams[slug].playerPage,
    embedUrl: source.streams[slug].embedUrl,
  };
}
await writeFile(
  STREAMS,
  JSON.stringify({ ...primary, ...wanted }, null, 2),
  "utf8",
);

const child = spawn(
  process.execPath,
  [resolve(__dirname, "measure-quality.mjs"), "--out", OUT, ...slugs],
  { stdio: ["ignore", "ignore", "inherit"] },
);
const code = await new Promise((res) => child.on("close", res));
await writeFile(STREAMS, backup, "utf8");

if (code !== 0) {
  console.error("[canale-tv] the measurement failed; the stream file was restored");
  process.exit(code ?? 1);
}

const measured = await readJson(OUT, { feeds: {} });
const quality = await readJson(QUALITY, { feeds: {} });
quality.feeds = { ...quality.feeds, ...measured.feeds };
quality.generatedAt = new Date().toISOString();
await writeFile(QUALITY, JSON.stringify(quality, null, 2), "utf8");
await rm(OUT, { force: true });

const counts = {};
for (const feed of Object.values(measured.feeds ?? {})) {
  counts[feed.quality] = (counts[feed.quality] || 0) + 1;
}
console.log("[canale-tv] measured:", JSON.stringify(counts));
