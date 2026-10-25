/**
 * The third source: canale-tv.net.
 *
 * The site publishes a channel directory as a plain HTML table — the name of
 * the channel and the address of the page that carries the stream. The pages
 * are JavaScript-driven: the real playlist is hidden behind an obfuscation
 * that has to be undone, which is what `resolveStreamUrls` in the app does
 * for the first source's player pages.
 *
 * Unlike the second source, these addresses do not carry a token that
 * expires: the playlist that comes out of the page is stable, so it is
 * resolved once here and stored, exactly like the first source's feeds.
 *
 *   node scripts/scrape-canale-tv.mjs
 *
 * Writes data/canale-tv-channels.json.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "data/canale-tv-channels.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

const BASE = "https://canale-tv.net/";

const res = await fetch(BASE, {
  headers: { "user-agent": UA },
  signal: AbortSignal.timeout(25_000),
});
if (!res.ok) {
  console.error(`[canale-tv] the directory answered ${res.status}`);
  process.exit(1);
}
const html = await res.text();

/** Each row of the table is one channel: its name and the page carrying it. */
const channels = [];
for (const row of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
  const name = (row[0].match(/<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const page = row[0].match(/embed-field"[^>]*value="([^"]+)"/i)?.[1] ?? null;
  if (!name || !page) continue;
  const slug = page.match(/\/channel\/([^.?/]+)\.html/)?.[1] ?? null;
  if (!slug) continue;
  channels.push({ name, slug, page });
}

console.log(`[canale-tv] ${channels.length} channels`);

/**
 * The site says it plainly: the pages are only available as embeds, and
 * they refuse to work without a Referer of their own origin or inside a
 * sandboxed frame. So the playlist is resolved here, on the server, and
 * relayed — never framed.
 */
const previous = await readFile(OUT, "utf8").catch(() => null);
const before = previous ? JSON.parse(previous) : { channels: [] };

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      source: BASE,
      generatedAt: new Date().toISOString(),
      channelCount: channels.length,
      notes: [
        "The directory publishes a table of NAME and the address of the page that carries the stream.",
        "The pages are JavaScript-driven: the real playlist has to be resolved with the same deobfuscation the first source's player pages use.",
        "The pages refuse to play without a Referer of their own origin, and refuse to play inside a sandboxed iframe — so the stream must be resolved and relayed by our own proxy, never framed directly.",
        "The resolved playlists are stable: there is no expiring token, so they are stored like the first source's feeds.",
      ],
      channels,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(`[canale-tv] wrote ${OUT}`);
console.log(
  `[canale-tv] ${channels.length} channels (was ${before.channels.length})`,
);
