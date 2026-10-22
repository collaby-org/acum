/**
 * The player endpoint, in two shapes.
 *
 * `GET /api/player?s=<channelId>.<serverId>` — the last resort. The server
 * fetches the upstream player page, strips every ad script and tracker out of
 * it, injects a script that presses the upstream's own poster and closes the
 * `window.open` escape hatch, and serves the result with a sandboxed
 * content-security policy. The visitor sees the upstream's chrome, but no ad
 * window and no tracker.
 *
 * `POST /api/player { channel }` — the manifest. The server resolves every
 * feed of the channel into a playlist URL, checks that each one answers, and
 * returns a single ordered chain the client can walk: when one link dies the
 * player moves to the next instead of showing a dead frame.
 *
 * The client names a channel; it never names an upstream address. The
 * catalogue that holds those addresses stays on the server.
 */
import {
  fetchEmbedPage,
  fetchPlayerPage,
  isAllowedEmbedUrl,
  isAllowedMediaUrl,
  isAllowedSourceUrl,
  isResolvablePageUrl,
  probePlaylist,
  resolveStreamUrls,
  sanitizeUpstreamPage,
  signStreamToken,
} from "@/lib/stream";
import { catalogueChannel, resolveServerRef } from "@/lib/catalogue";
import { secondaryStreamUrl } from "@/lib/secondary";
import type { Server } from "@/data/types";

type ServerInput = {
  id?: unknown;
  label?: unknown;
  embedUrl?: unknown;
  sourcePage?: unknown;
  hlsUrl?: unknown;
  source?: unknown;
};

type ResolvedServer = {
  id: string;
  label: string;
  embedUrl: string | null;
  sourcePage: string | null;
  hlsUrl: string | null;
  source: "primary" | "secondary";
};

function readServer(value: ServerInput): ResolvedServer {
  return {
    id: typeof value.id === "string" ? value.id : "",
    label: typeof value.label === "string" ? value.label : "",
    embedUrl: typeof value.embedUrl === "string" ? value.embedUrl : null,
    sourcePage: typeof value.sourcePage === "string" ? value.sourcePage : null,
    hlsUrl: typeof value.hlsUrl === "string" ? value.hlsUrl : null,
    source: value.source === "secondary" ? "secondary" : "primary",
  };
}

/**
 * The playlists a feed can be read from, in the order the upstream lists.
 *
 * A playlist that was resolved at build time wins. Otherwise the feed's own
 * page is read and its obfuscation undone — that works for the player pages
 * on canale-tv.net and for the panels on the `.cfd` and `.shop` hosts alike.
 */
async function candidatesOf(server: ResolvedServer): Promise<string[]> {
  // The second source's addresses are short-lived, so they are fetched fresh
  // rather than read from the catalogue.
  if (server.source === "secondary") {
    const url = await secondaryStreamUrl(server.id);
    return url && isAllowedMediaUrl(url) ? [url] : [];
  }
  if (server.hlsUrl && isAllowedMediaUrl(server.hlsUrl)) {
    return [server.hlsUrl];
  }
  if (!isResolvablePageUrl(server.embedUrl)) return [];

  const html = await fetchPlayerPage(server.embedUrl);
  if (!html) return [];

  return resolveStreamUrls(html).filter(isAllowedMediaUrl);
}

/**
 * The frame to fall back to when a feed has no playlist at all.
 *
 * The channel page on the site that publishes the feeds is framed directly:
 * the panel inside it then sees the Referer it needs, which is the whole
 * reason that path works at all. It is sandboxed without `allow-popups`, so
 * no ad window can open.
 */
function fallbackFrame(server: ResolvedServer): string | null {
  if (isAllowedSourceUrl(server.sourcePage)) return server.sourcePage;
  if (isAllowedEmbedUrl(server.embedUrl)) {
    return `/api/player?u=${encodeURIComponent(server.embedUrl)}`;
  }
  return null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const u = params.get("u");
  const reference = params.get("s");

  // A reference to a feed of the catalogue: the upstream page is fetched
  // here, so the browser never holds its address.
  if (!u && reference) {
    const resolved = await resolveServerRef(reference);
    if (!resolved) {
      return new Response("Canal necunoscut.", { status: 404 });
    }
    if (resolved.kind === "embed") {
      const html = await fetchEmbedPage(resolved.url);
      if (!html) {
        return new Response("Pagina sursă nu a putut fi citită.", {
          status: 502,
        });
      }
      return new Response(sanitizeUpstreamPage(html, resolved.url), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy":
            "sandbox allow-scripts allow-same-origin allow-presentation",
          "cache-control": "no-store",
        },
      });
    }
    return Response.json(
      { error: "Acest flux nu are o pagină de rezervă." },
      { status: 400 },
    );
  }

  if (!isAllowedEmbedUrl(u)) {
    return new Response("Adresă nepermisă.", { status: 400 });
  }

  const html = await fetchEmbedPage(u);
  if (!html) {
    return new Response("Pagina sursă nu a putut fi citită.", { status: 502 });
  }

  return new Response(sanitizeUpstreamPage(html, u), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "sandbox allow-scripts allow-same-origin allow-presentation",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  let payload: { channel?: unknown; servers?: ServerInput[] };
  try {
    payload = (await request.json()) as {
      channel?: unknown;
      servers?: ServerInput[];
    };
  } catch {
    return Response.json({ error: "Cerere invalidă." }, { status: 400 });
  }

  // The catalogue is the source of truth for the feeds.
  let servers: ResolvedServer[];
  if (typeof payload.channel === "string") {
    const channel = catalogueChannel(payload.channel);
    if (!channel) {
      return Response.json({ error: "Canal necunoscut." }, { status: 404 });
    }
    servers = channel.servers.map(readServer);
  } else {
    servers = (payload.servers ?? [])
      .filter(
        (value): value is ServerInput =>
          Boolean(value) && typeof value === "object",
      )
      .map(readServer)
      .slice(0, 12);
  }

  const perServer = await Promise.all(
    servers.map(async (server) => ({
      server,
      candidates: await candidatesOf(server),
    })),
  );

  const seen = new Set<string>();
  const links: { server: ResolvedServer; candidate: string }[] = [];
  const frames: { server: ResolvedServer; url: string }[] = [];

  for (const entry of perServer) {
    let resolved = false;
    for (const candidate of entry.candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      links.push({ server: entry.server, candidate });
      resolved = true;
    }
    if (!resolved) {
      const frame = fallbackFrame(entry.server);
      if (frame) frames.push({ server: entry.server, url: frame });
    }
  }

  const sources = await Promise.all(
    links.map(async ({ server, candidate }) => ({
      id: server.id,
      label: server.label,
      kind: "hls" as const,
      url: `/api/stream?t=${signStreamToken(candidate)}`,
      playable: await probePlaylist(candidate),
    })),
  );

  const embedded = frames.map(({ server, url }) => ({
    id: server.id,
    label: server.label,
    kind: "embed" as const,
    url,
    playable: true,
  }));

  const ordered = [
    ...sources.filter((source) => source.playable),
    ...sources.filter((source) => !source.playable),
    ...embedded,
  ];

  return Response.json({ sources: ordered });
}

export type { Server };
