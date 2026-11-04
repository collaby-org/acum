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
  isStreamTokenConfigured,
  probePlaylist,
  resolveStreamUrls,
  signStreamToken,
  StreamPolicyError,
  pickServer,
} from "@/lib/stream";
import { catalogueChannel } from "@/lib/catalogue";
import { secondaryStreamUrl } from "@/lib/secondary";
import { gate } from "@/lib/account-gate";
import { claimStream, deviceFrom } from "@/lib/stream-sessions";
import { bearerToken } from "@/lib/supabase/server";
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
  /**
   * The gate.
   *
   * This route mints the signed address of a stream, so it is the place the
   * allowance is enforced. A visitor whose two hours are spent gets no
   * address at all — there is nothing to pull and nothing to bypass. The
   * client is told why, so it can show the wall.
   */
  const verdict = await gate(request);
  if (!verdict.allowed) {
    return Response.json(
      { error: "paywall", reason: verdict.reason },
      { status: 403, headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  }

  if (!isStreamTokenConfigured()) {
    return Response.json(
      { error: "Serviciul de streaming nu este configurat." },
      { status: 503, headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  }

  let payload: {
    channel?: unknown;
    viewer?: unknown;
  };
  try {
    payload = (await request.json()) as {
      channel?: unknown;
      /** The viewer, as the browser named them. */
      viewer?: unknown;
    };
  } catch {
    return Response.json(
      { error: "Cerere invalidă." },
      { status: 400, headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  }

  // The catalogue is the source of truth for the feeds. Browser-supplied
  // server objects are deliberately ignored: they would turn this endpoint
  // into a request forwarder for arbitrary upstream pages.
  if (typeof payload.channel !== "string") {
    return Response.json(
      { error: "Canalul este obligatoriu." },
      { status: 400, headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  }

  const channel = catalogueChannel(payload.channel);
  if (!channel) {
    return Response.json(
      { error: "Canal necunoscut." },
      { status: 404, headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  }

  // The catalogue's feeds, ordered by how likely they are to play: a
  // resolved playlist first, then the directory's own address, then the
  // pages whose obfuscation we can undo. Feeds that cannot produce a URL
  // (an acestream id, a dead page) are dropped here rather than shipped to
  // the browser to fail on.
  const servers = pickServer(channel).map(readServer);
  const channelId = channel.id;

  /**
   * The stream itself.
   *
   * The gate has already decided that the allowance is not spent. This is
   * the second question, and the one a plan is about: how many screens may
   * run at once, and is this the house's own device. A refusal here is not
   * a wall over the picture — it is a sentence the player can act on.
   */
  const authorization = bearerToken(request);
  const claim =
    authorization && verdict.userId
      ? await claimStream({
          token: authorization,
          userId: verdict.userId,
          device: deviceFrom(request),
          channelId,
        })
      : null;

  if (claim && !claim.allowed) {
    if (claim.reason === "stream_limit") {
      const one = claim.limit === 1;
      return Response.json(
        {
          error: `Ai atins limita de ${claim.limit} ${one ? "flux" : "fluxuri"} simultane din planul tău. Închide un alt ecran și reîncearcă.`,
          reason: claim.reason,
          limit: claim.limit,
          active: claim.active,
        },
        {
          status: 429,
          headers: { "cache-control": "no-store", pragma: "no-cache" },
        },
      );
    }

    return Response.json(
      {
        error:
          "Acest dispozitiv nu este cel înregistrat pentru casă. Confirmă dispozitivul și reluăm.",
        reason: claim.reason,
      },
      {
        status: 403,
        headers: { "cache-control": "no-store", pragma: "no-cache" },
      },
    );
  }

  const sessionId = claim?.allowed ? claim.sessionId : null;

  /**
   * The viewer.
   *
   * It is a random value the browser keeps for the session. It identifies a
   * browser, not a person, and it is the only thing the audience count is
   * built from — which is why it travels with every segment request.
   */
  const viewer =
    typeof payload.viewer === "string" && payload.viewer.length <= 64
      ? payload.viewer
      : null;

  let perServer: { server: ResolvedServer; candidates: string[] }[];
  try {
    perServer = await Promise.all(
      servers.map(async (server) => ({
        server,
        candidates: await candidatesOf(server),
      })),
    );
  } catch (error) {
    if (error instanceof StreamPolicyError) {
      return Response.json(
        { error: "Adresă nepermisă." },
        {
          status: 403,
          headers: { "cache-control": "no-store", pragma: "no-cache" },
        },
      );
    }
    throw error;
  }

  const seen = new Set<string>();
  const links: { server: ResolvedServer; candidate: string }[] = [];

  for (const entry of perServer) {
    for (const candidate of entry.candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      links.push({ server: entry.server, candidate });
    }
  }

  let sources: {
    id: string;
    label: string;
    kind: "hls";
    url: string;
    playable: boolean;
  }[];
  try {
    sources = await Promise.all(
      links.map(async ({ server, candidate }) => {
        const url = `/api/stream?t=${signStreamToken(
          candidate,
          channelId ?? undefined,
          undefined,
          sessionId ?? undefined,
          viewer ?? undefined,
        )}`;
        return {
          id: server.id,
          label: server.label,
          kind: "hls" as const,
          // The channel, session and viewer are signed into the address, so
          // the proxy can count the audience per channel without trusting a
          // browser-supplied query parameter.
          url,
          playable: await probePlaylist(candidate, 6_000),
        };
      }),
    );
  } catch (error) {
    if (error instanceof StreamPolicyError) {
      return Response.json(
        { error: "Adresă nepermisă." },
        {
          status: 403,
          headers: { "cache-control": "no-store", pragma: "no-cache" },
        },
      );
    }
    throw error;
  }

  // Only answering links are handed over when there is at least one: the
  // player would otherwise sit eight seconds on a dead address before it
  // moved on. When nothing answered, the whole list still goes out — a probe
  // can be wrong, and the browser is the better judge.
  const playable = sources.filter((source) => source.playable);

  return Response.json(
    {
      sources: playable.length > 0 ? playable : sources,
      session: sessionId,
    },
    {
      headers: { "cache-control": "no-store", pragma: "no-cache" },
    },
  );
}

export type { Server };
