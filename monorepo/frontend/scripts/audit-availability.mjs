/**
 * Availability audit: how many channels actually play right now?
 *
 * The honest path is the one a visitor takes: ask the server for the chain,
 * then fetch each link and see whether a playlist comes back. A channel that
 * only has a stale "live" flag in the catalogue is not available.
 */
import { readFileSync, writeFileSync } from "node:fs";

const APP = process.argv[2] ?? "http://127.0.0.1:3115/";
const OUT =
  process.argv[3] ?? "D:/Work/Romanian TV Live/data/availability.json";

const source = readFileSync(
  "D:/Work/Romanian TV Live/src/data/channels.ts",
  "utf8",
);
const match = source.match(
  /export const CHANNELS: UpstreamChannel\[\] = ([\s\S]*?);\n\nexport const CHANNEL_COUNT/,
);
const channels = JSON.parse(match[1]);

const probe = async (url) => {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; vizor-audit)" },
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, why: `http ${res.status}` };
    if (!text.includes("#EXTM3U")) {
      return { ok: false, why: "not a playlist" };
    }
    return { ok: true, bytes: text.length };
  } catch (error) {
    return { ok: false, why: String(error?.message ?? error).slice(0, 80) };
  }
};

const results = [];
let index = 0;

for (const channel of channels) {
  index += 1;
  const record = {
    id: channel.id,
    name: channel.name,
    declared: channel.status,
    feeds: channel.servers.length,
    sources: 0,
    working: 0,
    why: null,
  };

  try {
    const res = await fetch(new URL("/api/player", APP), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: channel.id }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      record.why = `manifest ${res.status}`;
      results.push(record);
      continue;
    }
    const payload = await res.json();
    const sources = payload.sources ?? [];
    record.sources = sources.length;
    for (const s of sources) {
      if (s.kind !== "hls") {
        record.working += 1;
        continue;
      }
      const url = new URL(s.url, APP).href;
      const verdict = await probe(url);
      if (verdict.ok) record.working += 1;
      else if (!record.why) record.why = verdict.why;
    }
  } catch (error) {
    record.why = String(error?.message ?? error).slice(0, 80);
  }

  results.push(record);
  if (index % 10 === 0) {
    const ok = results.filter((r) => r.working > 0).length;
    console.log(`[audit] ${index}/${channels.length} · playable so far ${ok}`);
  }
}

const playable = results.filter((r) => r.working > 0);
const dead = results.filter((r) => r.working === 0);

console.log("");
console.log(`[audit] channels        ${channels.length}`);
console.log(`[audit] playable        ${playable.length}`);
console.log(`[audit] dead            ${dead.length}`);
console.log("");
console.log("[audit] dead list:");
for (const r of dead) {
  console.log(
    `  ${r.name.padEnd(24)} declared=${String(r.declared).padEnd(9)} feeds=${r.feeds} sources=${r.sources}  ${r.why ?? ""}`,
  );
}

writeFileSync(
  OUT,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
  "utf8",
);
console.log(`[audit] wrote ${OUT}`);
