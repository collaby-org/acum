/**
 * cool-etv.net channel + embed extractor.
 *
 * Walks the site's mega-menu, opens every channel page and records the
 * player that page actually ships (iframe embed URL, AceStream content id,
 * or a local HLS bridge). Dependency-free: Node built-ins only.
 *
 *   node scripts/scrape-channels.mjs
 *
 * Writes data/channels.raw.json — the intermediate artifact the app's
 * curated dataset is generated from.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = "https://www.cool-etv.net";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'", "#160": " ",
};

const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

const stripTags = (s) => decodeEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
}

/* ------------------------------------------------------------------ *
 * Mega-menu: channel families and their feeds
 * ------------------------------------------------------------------ */
function parseMenu(html) {
  const start = html.indexOf('id="mb5czmebul_table"');
  if (start < 0) throw new Error("mega menu not found");
  const slice = html.slice(start);

  const groups = [];
  // The mega-menu is a flat list of <ul class="img_40"> blocks. Each block's
  // family header is the last anchor that precedes it, in either of the two
  // header shapes the site uses:
  //   <li title="…"><div class="arrow buttonbg">…<a>NAME</a>…</div><ul class="img_40">…
  //   <li><a class="with_img_40 with_arrow">…NAME</a><ul class="img_40">…
  const blockRe = /<ul class="img_40">([\s\S]*?)<\/ul>/g;
  const anchorsBefore = (end) => {
    const head = slice.slice(0, end);
    const last = [...head.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].pop();
    return last ? stripTags(last[1]) : null;
  };

  let m;
  let prevEnd = 0;
  while ((m = blockRe.exec(slice)) !== null) {
    const between = slice.slice(prevEnd, m.index);
    const titleAttr = between.match(/<li[^>]*\stitle="([^"]+)"/i)?.[1] ?? null;
    const family = anchorsBefore(m.index);
    prevEnd = m.index + m[0].length;
    if (!family) continue;

    const kids = [];
    const kidRe = /<a\s+href="(ch\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let k;
    while ((k = kidRe.exec(m[1])) !== null) {
      const inner = k[2];
      const iconMatch = inner.match(/<img[^>]+src="([^"]+)"/i);
      kids.push({
        slug: k[1].replace(/^ch\//, "").replace(/\.htm$/, ""),
        label: stripTags(inner),
        icon: iconMatch ? iconMatch[1] : null,
      });
    }
    if (kids.length) groups.push({ family, title: titleAttr, kids });
  }
  return groups;
}

/* ------------------------------------------------------------------ *
 * Channel page: the player that page ships
 * ------------------------------------------------------------------ */
function parseChannelPage(html, pageUrl) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? stripTags(titleMatch[1]) : null;

  const embeds = [];
  const iframeRe = /<iframe\b[^>]*>/gi;
  let im;
  while ((im = iframeRe.exec(html)) !== null) {
    const tag = im[0];
    const ds =
      tag.match(/data-src\s*=\s*"([^"]*)"/i) || tag.match(/\bsrc\s*=\s*"([^"]*)"/i);
    if (!ds || !ds[1].trim()) continue;
    const url = decodeEntities(ds[1]).trim();
    if (!url || /^(about:|javascript:|data:)/i.test(url)) continue;
    let abs;
    try {
      abs = new URL(url, pageUrl).href;
    } catch {
      continue;
    }
    if (!/^https?:/i.test(abs)) continue;
    if (!embeds.includes(abs)) embeds.push(abs);
  }

  const acestream =
    html.match(/acestream:\/\/([a-z0-9]{20,60})\//i)?.[1] ??
    html.match(/loadContentId\(\s*"([a-z0-9]{20,60})"/i)?.[1] ??
    null;

  // A local bridge player (the desktop plugin) — not reachable from a browser.
  const localHls = /http:\/\/127\.0\.0\.1:6878\/hls\/manifest\.m3u8\?id=([a-z0-9]+)/i.exec(html)?.[1] ?? null;

  const directStreams = [
    ...new Set(
      [...html.matchAll(/https?:\/\/[^\s"'<>\\)]+\.(?:m3u8|mp4|ts|flv)(?:\?[^\s"'<>\\)]*)?/gi)]
        .map((x) => decodeEntities(x[0]))
        .filter((u) => !/127\.0\.0\.1|localhost/.test(u))
    ),
  ];

  return { rawTitle, embeds, acestreamId: acestream, localHlsId: localHls, directStreams };
}

/* ------------------------------------------------------------------ *
 * Crawl
 * ------------------------------------------------------------------ */
async function main() {
  const home = await get(`${BASE}/`);
  const groups = parseMenu(home);
  const feeds = groups.flatMap((g) => g.kids.map((k) => ({ ...k, family: g.family })));
  console.log(`[menu] ${groups.length} families, ${feeds.length} feeds`);

  // The menu occasionally points two entries at the same feed (the source
  // lists "S1" and "S2" for one slug). Both are crawled, but the taxonomy
  // treats them as the single server they really are.
  const seen = new Map();
  for (const f of feeds) {
    if (seen.has(f.slug)) console.warn(`[menu] duplicate slug "${f.slug}" — ${f.family}`);
    else seen.set(f.slug, f);
  }
  console.log(`[menu] ${seen.size} distinct feeds`);

  const out = [];
  const CONCURRENCY = 8;
  let cursor = 0;

  async function worker() {
    while (cursor < feeds.length) {
      const feed = feeds[cursor++];
      const url = `${BASE}/ch/${feed.slug}.htm`;
      let page = null;
      let error = null;
      try {
        page = parseChannelPage(await get(url), url);
      } catch (err) {
        error = String(err?.message || err);
      }
      out.push({
        slug: feed.slug,
        family: feed.family,
        label: feed.label,
        icon: feed.icon ? (feed.icon.startsWith("http") ? feed.icon : BASE + feed.icon) : null,
        sourcePage: url,
        rawTitle: page?.rawTitle ?? null,
        embedUrl: page?.embeds?.[0] ?? null,
        embeds: page?.embeds ?? [],
        acestreamId: page?.acestreamId ?? null,
        localHlsId: page?.localHlsId ?? null,
        directStreams: page?.directStreams ?? [],
        error,
      });
      if (out.length % 25 === 0) console.log(`[crawl] ${out.length}/${feeds.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const order = new Map(feeds.map((f, i) => [f.slug, i]));
  out.sort((a, b) => order.get(a.slug) - order.get(b.slug));

  const target = resolve(__dirname, "../data/channels.raw.json");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(
    target,
    JSON.stringify({ source: BASE, generatedAt: new Date().toISOString(), groups, channels: out }, null, 2),
    "utf8"
  );

  const withEmbed = out.filter((c) => c.embedUrl).length;
  const withAce = out.filter((c) => !c.embedUrl && c.acestreamId).length;
  const withLocal = out.filter((c) => !c.embedUrl && !c.acestreamId && c.localHlsId).length;
  console.log(
    `[done] ${out.length} channels — ${withEmbed} iframe embed, ${withAce} acestream, ${withLocal} local-hls, ${
      out.length - withEmbed - withAce - withLocal
    } unknown`
  );
  for (const c of out.filter((x) => !x.embedUrl)) {
    console.log(`   ! ${c.slug.padEnd(22)} ${c.family} / ${c.label}  ace=${c.acestreamId ?? "-"} local=${c.localHlsId ?? "-"} ${c.error ?? ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
