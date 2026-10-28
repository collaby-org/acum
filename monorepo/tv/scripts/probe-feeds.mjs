/**
 * Feed liveness probe.
 *
 * Every feed of the catalogue is walked through the path a visitor takes:
 * the app resolves the feed into a playlist, and the playlist is then
 * fetched — through our own proxy, and straight from the upstream — to see
 * whether the bytes arrive.
 *
 * Two answers are compared on purpose. When the upstream answers but our
 * proxy does not, the proxy is at fault and the feed is repairable. When
 * neither answers, the upstream is refusing the stream and no amount of
 * local work will bring it back — that feed is marked dead, not dressed up.
 *
 *   node scripts/probe-feeds.mjs [appUrl]
 *
 * Writes data/embed-health.json — the file the dataset builder reads to
 * decide which feeds are live.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harnessAuth } from "./harness-account.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const APP = process.argv[2] ?? "http://127.0.0.1:3115/";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

/**
 * The Referers the upstream hosts accept, best first.
 *
 * A host answers with a wall of HTML unless the request looks like it comes
 * from the page that embeds it — the site's own origin first, then the
 * publisher, then the directory that lists the stream.
 */
const REFERERS = [
  "https://canale-tv.net/",
  "https://www.cool-etv.net/",
  "https://canaletvlive.online/",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ *
 * The catalogue, as the taxonomy sees it
 * ------------------------------------------------------------------ */
const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(resolve(ROOT, file), "utf8"));
  } catch {
    return fallback;
  }
};

const taxonomy = await readJson("scripts/channel-taxonomy.json", { families: {} });
const raw = await readJson("data/channels.raw.json", { channels: [] });
const secondary = await readJson("data/secondary-sources.json", { channels: [] });
const canaleTv = await readJson("data/canale-tv-channels.json", { channels: [] });
const canaleTvStreams = await readJson("data/canale-tv-streams.json", { streams: {} });

const primaryBySlug = new Map();
for (const feed of raw.channels ?? []) {
  if (!primaryBySlug.has(feed.slug)) primaryBySlug.set(feed.slug, feed);
}
const secondaryBySlug = new Map(
  (secondary.channels ?? []).map((c) => [c.slug, c]),
);
const canaleTvBySlug = new Map(
  (canaleTv.channels ?? []).map((c) => [c.slug, c]),
);

/** Every feed of the catalogue, in taxonomy order. */
function catalogueFeeds() {
  const feeds = [];
  for (const [familyKey, family] of Object.entries(taxonomy.families ?? {})) {
    for (const channel of family.channels ?? []) {
      for (const server of channel.servers ?? []) {
        const isSecondary = server.source === "secondary";
        const isCanaleTv = server.source === "canale-tv";
        const source = isSecondary
          ? secondaryBySlug.get(server.slug)
          : isCanaleTv
            ? canaleTvBySlug.get(server.slug)
            : primaryBySlug.get(server.slug);

        feeds.push({
          key: `${isSecondary ? "secondary" : isCanaleTv ? "canale-tv" : "primary"}:${server.slug}`,
          channel: channel.name,
          familyKey,
          feed: server.slug,
          label: server.label ?? "S1",
          source: isSecondary ? "secondary" : isCanaleTv ? "canale-tv" : "primary",
          // The third source's playlist was resolved when the catalogue was
          // built, so it is handed over as the playlist it is. The other two
          // keep their page, and the app reads the address out of it.
          embedUrl: isCanaleTv
            ? null
            : isSecondary
              ? (source?.stream ?? null)
              : (source?.embedUrl ?? null),
          hlsUrl: isCanaleTv
            ? (canaleTvStreams.streams?.[server.slug]?.hlsUrl ?? null)
            : null,
          sourcePage: isCanaleTv
            ? (source?.page ?? null)
            : isSecondary
              ? (source?.sourcePage ?? null)
              : (source?.sourcePage ?? null),
        });
      }
    }
  }
  return feeds;
}

/* ------------------------------------------------------------------ *
 * Probing
 * ------------------------------------------------------------------ */

/** The upstream address a proxy token stands for. */
function decodeToken(token) {
  const payload = token.split(".")[0] ?? "";
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const colon = decoded.indexOf(":");
  return colon > 0 ? decoded.slice(colon + 1) : null;
}

/**
 * Ask the upstream for the stream, with every Referer it might accept.
 *
 * The verdict is about the upstream: "live" when a manifest comes back,
 * "blocked" when the host refuses, "error" when it does not answer at all.
 * A host that refuses one Referer may still serve another, so every
 * Referer is tried before the feed is called dead.
 */
async function probeUpstream(url) {
  const chain = [];
  try {
    chain.push(`${new URL(url).origin}/`);
  } catch {
    /* the caller already validated the URL */
  }
  // A host that refuses one Referer may still serve another, so every
  // Referer is tried before the feed is called dead.
  let blocked = null;
  let failure = null;
  for (const referer of [...chain, ...REFERERS]) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, referer, accept: "*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.text();
      const manifest = body.trimStart().startsWith("#EXTM3U");
      if (manifest && res.ok) {
        return { state: "live", why: `manifest, ${body.length}B`, status: res.status };
      }
      if (res.ok) {
        // The host answered, but not with a stream: a login page, a parked
        // domain or the panel's own shell.
        blocked = blocked ?? {
          state: "blocked",
          why: `no manifest (${res.status})`,
          status: res.status,
        };
        continue;
      }
      if (res.status === 403 || res.status === 401 || res.status === 402) {
        blocked = blocked ?? { state: "blocked", why: `http ${res.status}`, status: res.status };
        continue;
      }
      failure = failure ?? { state: "error", why: `http ${res.status}`, status: res.status };
    } catch (error) {
      failure = failure ?? {
        state: "error",
        why: String(error?.message ?? error).slice(0, 80),
        status: 0,
      };
    }
  }
  return blocked ?? failure ?? { state: "error", why: "not attempted", status: 0 };
}

/**
 * The state of the page a feed is played from.
 *
 * A feed with no playlist can still be framed: the publisher's page carries
 * its own player. That frame is only worth anything when the page behind it
 * answers — otherwise the visitor gets a broken player.
 */
async function probePanel(url) {
  if (!url) {
    // No embed at all: the feed is the desktop plugin, which a browser
    // cannot play.
    return { alive: false, state: "acestream", why: "no embed — desktop plugin only" };
  }

  const referers = ["https://www.cool-etv.net/"];
  try {
    referers.push(`${new URL(url).origin}/`);
  } catch {
    /* the caller already validated the URL */
  }

  let failure = null;
  for (const referer of referers) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": UA,
          referer,
          accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.text();
      if (res.ok) {
        return { alive: true, state: "live", why: `page ${res.status}, ${body.length}B` };
      }
      if (res.status === 403 || res.status === 401 || res.status === 402) {
        failure = failure ?? { alive: false, state: "blocked", why: `page http ${res.status}` };
        continue;
      }
      failure = failure ?? { alive: false, state: "error", why: `page http ${res.status}` };
    } catch (error) {
      failure = failure ?? {
        alive: false,
        state: "error",
        why: String(error?.message ?? error).slice(0, 80),
      };
    }
  }
  return failure ?? { alive: false, state: "error", why: "not attempted" };
}

/** Fetch the stream through our own proxy — the path the browser takes. */
async function probeProxy(url) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; vizor-probe)" },
      signal: AbortSignal.timeout(25_000),
    });
    const body = await res.text();
    return {
      ok: res.ok && body.trimStart().startsWith("#EXTM3U"),
      status: res.status,
      why: res.ok ? "no manifest" : `http ${res.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      why: String(error?.message ?? error).slice(0, 80),
    };
  }
}

/** The chain of sources the app resolves one feed into. */
async function chainFor(feed) {
  const res = await fetch(new URL("/api/player", APP), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // The product is account-gated, so the probe has to be signed in.
      ...(await harnessAuth()),
    },
    body: JSON.stringify({
      servers: [
        {
          id: feed.feed,
          label: feed.label,
          embedUrl: feed.embedUrl,
          sourcePage: feed.sourcePage ?? "",
          hlsUrl: feed.hlsUrl ?? null,
          source: feed.source,
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return { error: `manifest ${res.status}`, sources: [] };
  return res.json();
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */
const feeds = catalogueFeeds();
console.log(`[probe] ${feeds.length} feeds in the catalogue`);

try {
  const ping = await fetch(new URL("/api/trending", APP), {
    signal: AbortSignal.timeout(15_000),
  });
  if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
} catch (error) {
  console.error(
    `[probe] the app is not answering at ${APP} — start it with "npx next start --port 3115"`,
  );
  console.error(`[probe] ${String(error?.message ?? error)}`);
  process.exit(1);
}

const results = [];
let done = 0;

for (const feed of feeds) {
  const record = {
    key: feed.key,
    channel: feed.channel,
    family: feed.familyKey,
    feed: feed.feed,
    label: feed.label,
    source: feed.source,
    embedUrl: feed.embedUrl,
    streamUrl: null,
    state: "error",
    why: "",
    checkedAt: new Date().toISOString(),
  };

  try {
    const chain = await chainFor(feed);
    if (chain.error) {
      record.why = chain.error;
    } else {
      const hls = (chain.sources ?? []).filter((s) => s.kind === "hls");
      const embed = (chain.sources ?? []).filter((s) => s.kind === "embed");

      for (const source of hls) {
        const token = new URL(source.url, APP).searchParams.get("t");
        const upstream = token ? decodeToken(token) : null;
        if (upstream) record.streamUrl = upstream;
        const direct = upstream ? await probeUpstream(upstream) : null;
        const throughProxy = await probeProxy(new URL(source.url, APP).href);

        if (direct?.state === "live" && throughProxy.ok) {
          record.state = "live";
          record.why = "";
          break;
        }
        if (direct?.state === "live" && !throughProxy.ok) {
          // The upstream is fine, our proxy is not: the feed is repairable.
          record.state = "live";
          record.why = `proxy ${throughProxy.why}`;
          break;
        }
        record.state = direct?.state ?? "error";
        record.why = direct?.why ?? throughProxy.why;
      }

      // The second source's address carries a token that lives for minutes.
      // It is never written down: the app asks for a fresh one when the
      // feed is played.
      if (feed.source === "secondary" && record.streamUrl) {
        try {
          const parsed = new URL(record.streamUrl);
          parsed.searchParams.delete("token");
          record.streamUrl = parsed.toString();
        } catch {
          record.streamUrl = null;
        }
      }

      if (record.state !== "live" && embed.length) {
        // No playlist: the feed may still be framed. The frame is the
        // publisher's page, and it is only worth something when the player
        // behind it answers.
        const panel = await probePanel(feed.embedUrl);
        if (panel.alive) {
          record.state = "live";
          record.why = `frame ${embed[0].url}`;
          record.frame = embed[0].url;
        } else {
          record.state = panel.state;
          record.why = panel.why;
        }
      }
    }
  } catch (error) {
    record.why = String(error?.message ?? error).slice(0, 80);
  }

  results.push(record);
  done += 1;
  if (done % 20 === 0) {
    const live = results.filter((r) => r.state === "live").length;
    console.log(`[probe] ${done}/${feeds.length} · live so far ${live}`);
  }
  await sleep(120);
}

const tally = {};
for (const record of results) tally[record.state] = (tally[record.state] ?? 0) + 1;
console.log("[probe] states", tally);

const dead = results.filter((r) => r.state !== "live");
console.log(`[probe] ${dead.length} feed(s) not answering:`);
for (const record of dead) {
  console.log(
    `   ${record.source === "secondary" ? "2nd" : "1st"} ${record.feed.padEnd(22)} ${record.channel.padEnd(24)} ${record.state.padEnd(8)} ${record.why}`,
  );
}

const target = resolve(ROOT, "data/embed-health.json");
await mkdir(dirname(target), { recursive: true });
await writeFile(
  target,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      app: APP,
      states: tally,
      feeds: results,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(`[probe] wrote data/embed-health.json`);
