/**
 * The player endpoint.
 *
 * `POST /api/player { channel }` — the manifest. The server resolves every
 * feed of the channel into a playlist URL, checks that each one answers, and
 * returns a single ordered chain the client can walk: when one link dies the
 * player moves to the next instead of showing a dead frame.
 *
 * The client names a channel; it never names an upstream address. The
 * catalogue that holds those addresses stays on the server.
 *
 * There is deliberately no way to ask this endpoint for an upstream page.
 * It used to serve one, framed, as a last resort — and that was wrong twice
 * over: the upstream hosts answer a request that does not carry their own
 * Referer with a redirect to Google, so the frame never played anything, and
 * the directory page it pointed at carried the name of the site we relay.
 * Every byte that reaches the browser now goes through the stream proxy,
 * which checks the address against an allowlist first.
 */
import {
  fetchPlayerPage,
  isAllowedMediaUrl,
  isResolvablePageUrl,
  probePlaylist,
  resolveStreamUrls,
  signStreamToken,
} from "@/lib/stream";
import { catalogueChannel } from "@/lib/catalogue";
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
  source: "primary" | "secondary" | "canale-tv";
};

function readServer(value: ServerInput): ResolvedServer {
  return {
    id: typeof value.id === "string" ? value.id : "",
    label: typeof value.label === "string" ? value.label : "",
    embedUrl: typeof value.embedUrl === "string" ? value.embedUrl : null,
    sourcePage: typeof value.sourcePage === "string" ? value.sourcePage : null,
    hlsUrl: typeof value.hlsUrl === "string" ? value.hlsUrl : null,
    source:
      value.source === "secondary" || value.source === "canale-tv"
        ? value.source
        : "primary",
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
 * A feed that has no playlist is a feed that does not play.
 *
 * There used to be a frame as a last resort — the page on the site that
 * publishes the feeds. It was wrong twice over: it shows the visitor the
 * name of the site we relay, which is the one thing this product must never
 * do, and it does not even work. The upstream hosts answer a request that
 * does not carry their own Referer with a redirect to Google, and a browser
 * can only send our address, so the panel inside the frame never gets its
 * picture. What rendered was Google's page.
 *
 * So the catalogue says a dead feed is dead, instead of dressing it up.
 */
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

  for (const entry of perServer) {
    for (const candidate of entry.candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      links.push({ server: entry.server, candidate });
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

  // The playable links come first, so the player starts on a feed that is
  // answering and only walks further down the list when one of them dies.
  const ordered = [
    ...sources.filter((source) => source.playable),
    ...sources.filter((source) => !source.playable),
  ];

  return Response.json({ sources: ordered });
}

export type { Server };
