/**
 * Resolve the third source's playlists.
 *
 * Each channel page hides the real playlist behind the same obfuscation the
 * first source's player pages use, so the same resolver does the work. The
 * playlists that come out are stable — there is no expiring token — so they
 * are stored, and the build can use them like any other feed.
 *
 *   node scripts/resolve-canale-tv.mjs
 *
 * Writes data/canale-tv-streams.json.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveStreamUrls, asciiUrl } from "../src/lib/stream.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SOURCE = resolve(ROOT, "data/canale-tv-channels.json");
const OUT = resolve(ROOT, "data/canale-tv-streams.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

const source = JSON.parse(await readFile(SOURCE, "utf8"));

const streams = {};
let resolved = 0;
let missed = 0;

for (const [index, channel] of source.channels.entries()) {
  try {
    const res = await fetch(channel.page, {
      headers: { "user-agent": UA, referer: "https://canale-tv.net/" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await res.text();
    const urls = resolveStreamUrls(body);
    if (urls.length === 0) {
      missed += 1;
      console.log(`[canale-tv] ${channel.slug}: no playlist`);
      continue;
    }
    streams[channel.slug] = {
      hlsUrl: asciiUrl(urls[0]),
      playerPage: channel.page,
      embedUrl: channel.page,
      alternates: urls.slice(1, 3).map(asciiUrl),
    };
    resolved += 1;
  } catch (error) {
    missed += 1;
    console.log(`[canale-tv] ${channel.slug}: ${error?.message ?? error}`);
  }

  if ((index + 1) % 20 === 0) {
    console.log(`[canale-tv] ${index + 1}/${source.channels.length} · ${resolved} resolved`);
  }
}

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      source: source.source,
      generatedAt: new Date().toISOString(),
      resolved,
      missed,
      streams,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(
  `[canale-tv] ${resolved} resolved, ${missed} missed — wrote ${OUT}`,
);
